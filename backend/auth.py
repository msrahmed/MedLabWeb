
import hashlib
import hmac
import base64

from datetime import datetime, timedelta
from argon2 import PasswordHasher
from argon2.exceptions import (
    VerifyMismatchError,
    VerificationError,
    InvalidHashError,
)

# Modern password hashing configuration
password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16,
)

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 30
PASSWORD_EXPIRATION_DAYS = 90


def hash_web_password(password: str) -> str:
    """Create a modern Argon2id password hash."""
    return password_hasher.hash(password)


def verify_web_password(password: str, stored_hash: str) -> bool:
    """Verify an Argon2id password."""
    if not stored_hash:
        return False

    try:
        return password_hasher.verify(stored_hash, password)
    except (
        VerifyMismatchError,
        VerificationError,
        InvalidHashError,
    ):
        return False


def hash_legacy_password(password: str) -> str:
    """Reproduce the existing desktop SHA-256/Base64 hash."""
    password_bytes = password.encode("utf-8")
    digest = hashlib.sha256(password_bytes).digest()
    return base64.b64encode(digest).decode("ascii")


def verify_legacy_password(password: str, stored_hash: str) -> bool:
    """Verify an existing desktop password."""
    calculated_hash = hash_legacy_password(password)

    return hmac.compare_digest(
        calculated_hash,
        stored_hash or ""
    )


def validate_password(password: str, username: str) -> tuple[bool, str | None]:
    """Apply the existing MedLab password policy."""

    if not password:
        return False, "Password cannot be empty."

    if len(password) < 8:
        return False, "Password must be at least 8 characters."

    if len(password) > 128:
        return False, "Password cannot exceed 128 characters."

    if not any(c.isupper() for c in password):
        return False, "Password needs an uppercase letter."

    if not any(c.islower() for c in password):
        return False, "Password needs a lowercase letter."

    if not any(c.isdigit() for c in password):
        return False, "Password needs a digit."

    special_characters = "!@#$%^&*()_-+=[]{};:'\",.<>?/\\|`~"

    if not any(c in special_characters for c in password):
        return False, "Password needs a special character."

    if username and username.casefold() in password.casefold():
        return False, "Password cannot contain the username."

    return True, ""


def is_password_expired(password_changed_at: datetime | None) -> bool:
    """Check the existing 90-day expiration policy."""
    if password_changed_at is None:
        return True

    return datetime.now() > (
        password_changed_at + timedelta(days=PASSWORD_EXPIRATION_DAYS)
    )


def is_account_locked(locked_until: datetime | None) -> bool:
    """Check whether a timed account lockout is still active."""
    return locked_until is not None and datetime.now() < locked_until


def get_lockout_expiry() -> datetime:
    return datetime.now() + timedelta(minutes=LOCKOUT_MINUTES)
