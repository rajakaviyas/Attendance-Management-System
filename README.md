# Attendance Management System

Full stack Attendance Management System built with React, Flask, and MySQL.

## Features

- Authentication with JWT token support
- Employee add, edit, delete, detail view, and search
- Attendance marking, records, summary, and employee-wise history
- Dashboard statistics including department-wise employee counts
- Normalized MySQL schema with primary keys, foreign keys, constraints, and audit fields

## Project Structure

```text
backend/
  app.py
  config.py
  db.py
  requirements.txt
  .env.example
database/
  schema.sql
frontend/
  package.json
  index.html
  src/
```

## Database Setup

1. Create the database and tables:

```bash
mysql -u root -p < database/schema.sql
```

2. Update `backend/.env` from `backend/.env.example` with your MySQL credentials.

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The API runs at `http://localhost:5000`.

Default login:

- Username: `admin`
- Password: `admin123`

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The React app runs at `http://localhost:5173`.

## API Overview

- `POST /api/auth/login`
- `POST /api/employees`
- `GET /api/employees`
- `GET /api/employees/<id>`
- `PUT /api/employees/<id>`
- `DELETE /api/employees/<id>`
- `POST /api/attendance`
- `GET /api/attendance`
- `GET /api/attendance/summary`
- `GET /api/attendance/employee/<employee_id>`
- `GET /api/dashboard`
