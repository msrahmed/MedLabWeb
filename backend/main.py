
import os
from datetime import datetime, timedelta

from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import URL
from dotenv import load_dotenv

from auth import (
    verify_legacy_password,
    hash_web_password,
    verify_web_password,
    is_password_expired,
    is_account_locked,
    get_lockout_expiry,
    MAX_FAILED_ATTEMPTS,
)

load_dotenv()

# Database configuration
connection_url = URL.create(
    "mssql+pyodbc",
    host=r"localhost\SQLEXPRESS",
    database="LabDB",
    query={
        "driver": "ODBC Driver 18 for SQL Server",
        "Trusted_Connection": "yes",
        "Encrypt": "yes",
        "TrustServerCertificate": "yes",
    },
)

engine = create_engine(connection_url, pool_pre_ping=True)

# JWT configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing from .env")

# FastAPI application
app = FastAPI(title="MedLab Admin API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# JWT authentication
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = int(payload.get("sub"))

    except (JWTError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify that the account still exists and is active.
    with engine.connect() as connection:
        user = connection.execute(
            text("""
                SELECT Id, Username, FullName, Email, Role, Status
                FROM Users
                WHERE Id = :user_id
            """),
            {"user_id": user_id},
        ).mappings().first()

    if not user or user["Status"] != 0:
        raise HTTPException(
            status_code=401,
            detail="Account is inactive or unavailable.",
        )

    return dict(user)


def require_admin(
    current_user: dict = Depends(get_current_user),
):
    # UserRole.Administrator = 0
    if current_user["Role"] != 0:
        raise HTTPException(
            status_code=403,
            detail="Administrator access required.",
        )

    return current_user


@app.get("/")
def home():
    return {"application": "MedLab Admin", "status": "running"}


@app.get("/api/health")
def health(
current_user: dict = Depends(get_current_user),
):
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text("SELECT @@SERVERNAME, DB_NAME()")
            ).fetchone()

        return {
            "status": "connected",
            "server": result[0],
            "database": result[1],
        }

    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    
    

@app.get("/api/schema/tables")
def get_tables(
        current_user: dict = Depends(get_current_user),
):
    inspector = inspect(engine)

    tables = []

    for table_name in inspector.get_table_names():
        columns = inspector.get_columns(table_name)

        tables.append({
            "table": table_name,
            "columns": [
                {
                    "name": column["name"],
                    "type": str(column["type"]),
                    "nullable": column["nullable"]
                }
                for column in columns
            ]
        })

    return {"tables": tables}


@app.get("/api/schema/relationships")
def get_relationships(
current_user: dict = Depends(require_admin),
):
    inspector = inspect(engine)

    relationships = []

    for table_name in inspector.get_table_names():
        for fk in inspector.get_foreign_keys(table_name):
            relationships.append({
                "table": table_name,
                "columns": fk["constrained_columns"],
                "references_table": fk["referred_table"],
                "references_columns": fk["referred_columns"]
            })

    return {"relationships": relationships}


@app.get("/api/dashboard/summary")
def dashboard_summary(
    current_user: dict = Depends(get_current_user),
):
    try:
        with engine.connect() as connection:
            query = text("""
                SELECT
                    (SELECT COUNT(*) FROM Patients) AS patients,
                    (SELECT COUNT(*) FROM Visits) AS visits,
                    (SELECT COUNT(*) FROM Tests) AS tests,
                    (SELECT COUNT(*) FROM TestResults) AS test_results,
                    (SELECT COUNT(*) FROM Payments) AS payment_records,
                    (SELECT COALESCE(SUM(PaidAmount), 0)
                     FROM Visits) AS total_received,
                    (SELECT COALESCE(SUM(PendingAmount), 0)
                     FROM Visits) AS pending_amount,
                    (SELECT COUNT(*) FROM Reagents
                     WHERE IsActive = 1) AS active_reagents,
                    (SELECT COUNT(*) FROM Reagents
                     WHERE IsActive = 1
                     AND Quantity <= MinimumQuantity) AS low_stock
            """)

            result = connection.execute(query).mappings().one()

            return {
                key: float(value) if key in (
                    "total_received", "pending_amount"
                ) else int(value)
                for key, value in result.items()
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/patients")
def get_patients(
    search: str = "",
    limit: int = 25,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    try:
        limit = max(1, min(limit, 100))
        offset = max(0, offset)

        with engine.connect() as connection:
            query = text("""
                SELECT
                    ID,
                    Name,
                    Age,
                    Gender,
                    Contact,
                    RegistrationDate,
                    DOB,
                    AgeMonths
                FROM Patients
                WHERE
                    (:search = '')
                    OR Name LIKE :pattern
                    OR Contact LIKE :pattern
                    OR CAST(ID AS NVARCHAR(50)) LIKE :pattern
                ORDER BY RegistrationDate DESC, ID DESC
                OFFSET :offset ROWS
                FETCH NEXT :limit ROWS ONLY
            """)

            count_query = text("""
                SELECT COUNT(*)
                FROM Patients
                WHERE
                    (:search = '')
                    OR Name LIKE :pattern
                    OR Contact LIKE :pattern
                    OR CAST(ID AS NVARCHAR(50)) LIKE :pattern
            """)

            params = {
                "search": search,
                "pattern": f"%{search}%",
                "offset": offset,
                "limit": limit
            }

            patients = connection.execute(
                query, params
            ).mappings().all()

            total = connection.execute(
                count_query, params
            ).scalar_one()

            return {
                "patients": [dict(row) for row in patients],
                "total": total,
                "limit": limit,
                "offset": offset
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/api/schema/user-metadata")
def get_user_metadata(
current_user: dict = Depends(require_admin),
):
    try:
        with engine.connect() as connection:
            roles = connection.execute(text("""
                SELECT Role, COUNT(*) AS AccountCount
                FROM Users
                GROUP BY Role
                ORDER BY Role
            """)).mappings().all()

            statuses = connection.execute(text("""
                SELECT Status, COUNT(*) AS AccountCount
                FROM Users
                GROUP BY Status
                ORDER BY Status
            """)).mappings().all()

        return {
            "role_values": [dict(row) for row in roles],
            "status_values": [dict(row) for row in statuses]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class LoginRequest(BaseModel):
    username: str
    password: str


def create_access_token(user_id: int, role: int) -> str:
    now = datetime.utcnow()

    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(
            minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


@app.post("/api/auth/login")
def login(request: LoginRequest):
    username = request.username.strip()
    password = request.password

    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail="Username and password are required.",
        )

    with engine.connect() as connection:
        transaction = connection.begin()

        user = connection.execute(
            text("""
                SELECT Id, Username, PasswordHash, WebPasswordHash,
                       FullName, Email, Role, Status,
                       FailedLoginAttempts, LockedUntil,
                       PasswordChangedAt
                FROM Users
                WHERE Username = :username
            """),
            {"username": username},
        ).mappings().first()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password.",
            )

        user_id = user["Id"]
        status = user["Status"]
        failed_attempts = user["FailedLoginAttempts"] or 0
        locked_until = user["LockedUntil"]

        if status == 2:
            if is_account_locked(locked_until):
                raise HTTPException(
                    status_code=423,
                    detail="Account is temporarily locked.",
                )

            if locked_until is None:
                raise HTTPException(
                    status_code=423,
                    detail="Account is locked. Contact an administrator.",
                )

            connection.execute(
                text("""
                    UPDATE Users
                    SET Status = 0,
                        FailedLoginAttempts = 0,
                        LockedUntil = NULL
                    WHERE Id = :user_id
                """),
                {"user_id": user_id},
            )

            transaction.commit()
            transaction = connection.begin()

            status = 0
            failed_attempts = 0

        if status != 0:
            raise HTTPException(
                status_code=403,
                detail="This account is not active.",
            )

        if not verify_legacy_password(
            password,
            user["PasswordHash"],
        ):
            failed_attempts += 1

            if failed_attempts >= MAX_FAILED_ATTEMPTS:
                connection.execute(
                    text("""
                        UPDATE Users
                        SET FailedLoginAttempts = :attempts,
                            Status = 2,
                            LockedUntil = :locked_until
                        WHERE Id = :user_id
                    """),
                    {
                        "attempts": failed_attempts,
                        "locked_until": get_lockout_expiry(),
                        "user_id": user_id,
                    },
                )

                transaction.commit()

                raise HTTPException(
                    status_code=423,
                    detail="Too many failed attempts. Account locked for 30 minutes.",
                )

            connection.execute(
                text("""
                    UPDATE Users
                    SET FailedLoginAttempts = :attempts
                    WHERE Id = :user_id
                """),
                {
                    "attempts": failed_attempts,
                    "user_id": user_id,
                },
            )

            transaction.commit()

            raise HTTPException(
                status_code=401,
                detail="Invalid username or password.",
            )

        if is_password_expired(user["PasswordChangedAt"]):
            raise HTTPException(
                status_code=403,
                detail="PASSWORD_EXPIRED",
            )

        web_hash = user["WebPasswordHash"]

        if not verify_web_password(password, web_hash or ""):
            web_hash = hash_web_password(password)

        connection.execute(
            text("""
                UPDATE Users
                SET WebPasswordHash = :web_hash,
                    FailedLoginAttempts = 0,
                    LockedUntil = NULL,
                    LastLogin = :last_login
                WHERE Id = :user_id
            """),
            {
                "web_hash": web_hash,
                "last_login": datetime.now(),
                "user_id": user_id,
            },
        )

        token = create_access_token(
            user_id=user_id,
            role=user["Role"],
        )

        transaction.commit()

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "username": user["Username"],
                "full_name": user["FullName"],
                "email": user["Email"],
                "role": user["Role"],
            },
        }
