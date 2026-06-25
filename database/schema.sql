CREATE DATABASE IF NOT EXISTS attendance_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE attendance_management;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Admin', 'HR', 'Manager') NOT NULL DEFAULT 'Admin',
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  employee_id INT AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(30) NOT NULL UNIQUE,
  employee_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  mobile VARCHAR(20) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  updated_by INT NULL,
  CONSTRAINT fk_employees_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT chk_employee_email CHECK (email LIKE '%_@_%._%'),
  CONSTRAINT chk_employee_mobile CHECK (CHAR_LENGTH(mobile) BETWEEN 7 AND 20)
);

CREATE TABLE IF NOT EXISTS attendance (
  attendance_id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  check_in_time TIME NULL,
  check_out_time TIME NULL,
  attendance_status ENUM('Present', 'Absent', 'Half Day', 'Leave') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  updated_by INT NULL,
  CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_attendance_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT uq_employee_attendance_date UNIQUE (employee_id, attendance_date),
  CONSTRAINT chk_checkout_after_checkin CHECK (
    check_out_time IS NULL OR check_in_time IS NULL OR check_out_time >= check_in_time
  )
);

INSERT INTO users (username, password_hash, role, status)
VALUES ('admin', 'pbkdf2:sha256:1000000$6salWCaPHscsN6rY$5cb4b3b71a4a3d694156765e98a03c89c7ac1a0db3d7baf62c82660f5928ed06', 'Admin', 'Active')
ON DUPLICATE KEY UPDATE username = username;

INSERT INTO employees (employee_code, employee_name, email, mobile, department, designation, status)
VALUES
  ('EMP001', 'Aarav Sharma', 'aarav.sharma@example.com', '9876543210', 'Engineering', 'Software Engineer', 'Active'),
  ('EMP002', 'Meera Iyer', 'meera.iyer@example.com', '9876543211', 'Human Resources', 'HR Executive', 'Active'),
  ('EMP003', 'Rohan Mehta', 'rohan.mehta@example.com', '9876543212', 'Finance', 'Accountant', 'Inactive')
ON DUPLICATE KEY UPDATE employee_name = VALUES(employee_name);
