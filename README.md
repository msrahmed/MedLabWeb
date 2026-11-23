
# MedLab Admin Web

A web-based administration, monitoring, and report-access portal for the existing MedLab Laboratory Information System.

## Project Purpose

MedLab Admin Web complements the existing MedLab desktop application. It provides authorized administrators, staff, and patients with convenient web access to administrative information and published laboratory reports.

It is not intended to replace the laboratory's core desktop LIS workflows.

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Lucide React

### Backend
- Python
- FastAPI
- SQLAlchemy
- PyODBC
- SQL Server

### Authentication
- JWT access tokens
- Argon2 password hashing support
- Compatibility with existing MedLab desktop credentials

## Planned Modules

- Administrative dashboard
- Patient overview
- User management
- Financial overview
- System monitoring
- Report Centre
- Patient report portal

## Project Structure

```text
MedLabAdminWeb/
├── backend/
│   ├── main.py
│   ├── auth.py
│   ├── test_auth.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── .gitignore
└── README.md
```

## Local Development

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

Backend API: http://127.0.0.1:8000

API documentation: http://127.0.0.1:8000/docs

## Configuration

Create a local `.env` file in the backend directory using the required database and authentication settings.

Never commit real credentials, secrets, patient data, or database backups.

## Development Principles

- Preserve the existing desktop LIS.
- Maintain one authoritative source for laboratory transactions.
- Protect patient information.
- Enforce authentication and role-based authorization.
- Keep an audit trail for sensitive administrative and report-access operations.
- Publish only authorized laboratory reports.
