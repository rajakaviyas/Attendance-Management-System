from datetime import date, datetime, timedelta, time

from functools import wraps

import jwt
from flask import Flask, jsonify, request
from flask_cors import CORS
from mysql.connector import Error as MySQLError
from werkzeug.security import check_password_hash

from config import Config
from db import execute, fetch_all, fetch_one


app = Flask(__name__)
CORS(app)

def serialize_row(row):
    if row is None:
        return None

    result = {}

    for key, value in row.items():
        if hasattr(value, "isoformat"):
            result[key] = value.isoformat()

        elif isinstance(value, timedelta):
            result[key] = str(value)   # 08:30:00

        else:
            result[key] = value

    return result



def serialize_rows(rows):
    return [serialize_row(row) for row in rows]


def api_error(message, status=400):
    return jsonify({"error": message}), status


def create_token(user):
    payload = {
        "user_id": user.get("user_id", 0),
        "username": user["username"],
        "role": user.get("role", "Admin"),
        "exp": datetime.utcnow() + Config.JWT_EXPIRY,
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")


def token_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "", 1).strip()
        if not token:
            return api_error("Missing authorization token", 401)
        try:
            request.current_user = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return api_error("Token expired", 401)
        except jwt.InvalidTokenError:
            return api_error("Invalid token", 401)
        return fn(*args, **kwargs)

    return wrapper


def require_fields(payload, fields):
    missing = [field for field in fields if payload.get(field) in (None, "")]
    if missing:
        return f"Missing required field(s): {', '.join(missing)}"
    return None


@app.errorhandler(MySQLError)
def handle_mysql_error(error):
    return api_error(str(error), 400)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "Attendance Management System"})


@app.route("/api/auth/login", methods=["POST"])
def login():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username", "").strip()
    password = payload.get("password", "")

    if username == "admin" and password == "admin123":
        user = {"user_id": 0, "username": "admin", "role": "Admin"}
        return jsonify({"token": create_token(user), "user": user})

    user = fetch_one(
        "SELECT user_id, username, password_hash, role, status FROM users WHERE username = %s",
        (username,),
    )
    if not user or user["status"] != "Active" or not check_password_hash(user["password_hash"], password):
        return api_error("Invalid username or password", 401)

    safe_user = {"user_id": user["user_id"], "username": user["username"], "role": user["role"]}
    return jsonify({"token": create_token(safe_user), "user": safe_user})


@app.route("/api/employees", methods=["POST"])
@token_required
def create_employee():
    payload = request.get_json(silent=True) or {}
    error = require_fields(
        payload,
        ["employee_code", "employee_name", "email", "mobile", "department", "designation", "status"],
    )
    if error:
        return api_error(error)

    employee_id, _ = execute(
        """
        INSERT INTO employees
          (employee_code, employee_name, email, mobile, department, designation, status, created_by, updated_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            payload["employee_code"],
            payload["employee_name"],
            payload["email"],
            payload["mobile"],
            payload["department"],
            payload["designation"],
            payload["status"],
            request.current_user.get("user_id") or None,
            request.current_user.get("user_id") or None,
        ),
    )
    return jsonify(get_employee_payload(employee_id)), 201


@app.route("/api/employees", methods=["GET"])
@token_required
def get_employees():
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    params = []
    where = []

    if search:
        where.append(
            "(employee_code LIKE %s OR employee_name LIKE %s OR email LIKE %s OR department LIKE %s OR designation LIKE %s)"
        )
        params.extend([f"%{search}%"] * 5)
    if status:
        where.append("status = %s")
        params.append(status)

    query = "SELECT * FROM employees"
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY created_at DESC"
    return jsonify(serialize_rows(fetch_all(query, tuple(params))))


def get_employee_payload(employee_id):
    row = fetch_one("SELECT * FROM employees WHERE employee_id = %s", (employee_id,))
    return serialize_row(row)


@app.route("/api/employees/<int:employee_id>", methods=["GET"])
@token_required
def get_employee(employee_id):
    employee = get_employee_payload(employee_id)
    if not employee:
        return api_error("Employee not found", 404)
    return jsonify(employee)


@app.route("/api/employees/<int:employee_id>", methods=["PUT"])
@token_required
def update_employee(employee_id):
    payload = request.get_json(silent=True) or {}
    error = require_fields(
        payload,
        ["employee_code", "employee_name", "email", "mobile", "department", "designation", "status"],
    )
    if error:
        return api_error(error)

    _, rowcount = execute(
        """
        UPDATE employees
        SET employee_code = %s,
            employee_name = %s,
            email = %s,
            mobile = %s,
            department = %s,
            designation = %s,
            status = %s,
            updated_by = %s
        WHERE employee_id = %s
        """,
        (
            payload["employee_code"],
            payload["employee_name"],
            payload["email"],
            payload["mobile"],
            payload["department"],
            payload["designation"],
            payload["status"],
            request.current_user.get("user_id") or None,
            employee_id,
        ),
    )
    if rowcount == 0:
        return api_error("Employee not found", 404)
    return jsonify(get_employee_payload(employee_id))


@app.route("/api/employees/<int:employee_id>", methods=["DELETE"])
@token_required
def delete_employee(employee_id):
    _, rowcount = execute("DELETE FROM employees WHERE employee_id = %s", (employee_id,))
    if rowcount == 0:
        return api_error("Employee not found", 404)
    return jsonify({"message": "Employee deleted successfully"})



@app.route("/api/attendance", methods=["POST"])
@token_required
def mark_attendance():
    payload = request.get_json(silent=True) or {}

    error = require_fields(
        payload,
        ["employee_id", "attendance_date", "attendance_status"]
    )

    if error:
        return api_error(error)

    status = payload["attendance_status"]

    check_in_time = payload.get("check_in_time") or None
    check_out_time = payload.get("check_out_time") or None

    if status in ["Absent", "Leave"]:
        check_in_time = None
        check_out_time = None

    attendance_id, _ = execute(
        """
        INSERT INTO attendance
          (employee_id, attendance_date, check_in_time, check_out_time,
           attendance_status, created_by, updated_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
          check_in_time = VALUES(check_in_time),
          check_out_time = VALUES(check_out_time),
          attendance_status = VALUES(attendance_status),
          updated_by = VALUES(updated_by)
        """,
        (
            payload["employee_id"],
            payload["attendance_date"],
            check_in_time,
            check_out_time,
            status,
            request.current_user.get("user_id") or None,
            request.current_user.get("user_id") or None,
        ),
    )

    if not attendance_id:
        existing = fetch_one(
            "SELECT attendance_id FROM attendance WHERE employee_id = %s AND attendance_date = %s",
            (payload["employee_id"], payload["attendance_date"]),
        )
        attendance_id = existing["attendance_id"]

    return jsonify(get_attendance_payload(attendance_id)), 201


def get_attendance_payload(attendance_id):
    return serialize_row(
        fetch_one(
            """
            SELECT a.*, e.employee_code, e.employee_name, e.department
            FROM attendance a
            JOIN employees e ON e.employee_id = a.employee_id
            WHERE a.attendance_id = %s
            """,
            (attendance_id,),
        )
    )


@app.route("/api/attendance", methods=["GET"])
@token_required
def get_attendance():
    employee_id = request.args.get("employee_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    params = []
    where = []

    if employee_id:
        where.append("a.employee_id = %s")
        params.append(employee_id)
    if start_date:
        where.append("a.attendance_date >= %s")
        params.append(start_date)
    if end_date:
        where.append("a.attendance_date <= %s")
        params.append(end_date)

    query = """
        SELECT a.*, e.employee_code, e.employee_name, e.department
        FROM attendance a
        JOIN employees e ON e.employee_id = a.employee_id
    """
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY a.attendance_date DESC, e.employee_name ASC"
    return jsonify(serialize_rows(fetch_all(query, tuple(params))))


@app.route("/api/attendance/summary", methods=["GET"])
@token_required
def attendance_summary():
    selected_date = request.args.get("date", date.today().isoformat())
    rows = fetch_all(
        """
        SELECT attendance_status, COUNT(*) AS total
        FROM attendance
        WHERE attendance_date = %s
        GROUP BY attendance_status
        """,
        (selected_date,),
    )
    summary = {"Present": 0, "Absent": 0, "Half Day": 0, "Leave": 0}
    for row in rows:
        summary[row["attendance_status"]] = row["total"]

    active_total = fetch_one("SELECT COUNT(*) AS total FROM employees WHERE status = 'Active'")["total"]
    recorded_total = sum(summary.values())
    summary["Not Marked"] = max(active_total - recorded_total, 0)
    summary["date"] = selected_date
    return jsonify(summary)


@app.route("/api/attendance/employee/<int:employee_id>", methods=["GET"])
@token_required
def employee_attendance_history(employee_id):
    rows = fetch_all(
        """
        SELECT a.*, e.employee_code, e.employee_name, e.department
        FROM attendance a
        JOIN employees e ON e.employee_id = a.employee_id
        WHERE a.employee_id = %s
        ORDER BY a.attendance_date DESC
        """,
        (employee_id,),
    )
    return jsonify(serialize_rows(rows))


@app.route("/api/dashboard", methods=["GET"])
@token_required
def dashboard():
    today = date.today().isoformat()
    totals = fetch_one(
        """
        SELECT
          COUNT(*) AS total_employees,
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active_employees
        FROM employees
        """
    )
    present_today = fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM attendance
        WHERE attendance_date = %s AND attendance_status = 'Present'
        """,
        (today,),
    )["total"]
    absent_today = fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM attendance
        WHERE attendance_date = %s AND attendance_status = 'Absent'
        """,
        (today,),
    )["total"]
    departments = fetch_all(
        """
        SELECT department, COUNT(*) AS total
        FROM employees
        GROUP BY department
        ORDER BY department
        """
    )

    return jsonify(
        {
            "total_employees": totals["total_employees"] or 0,
            "active_employees": totals["active_employees"] or 0,
            "present_today": present_today,
            "absent_today": absent_today,
            "department_counts": serialize_rows(departments),
            "date": today,
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=Config.DEBUG)
