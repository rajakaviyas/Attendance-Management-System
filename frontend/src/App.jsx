import {
  BadgeCheck,
  CalendarCheck,
  Clock,
  Edit3,
  LogOut,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { apiRequest, buildQuery } from "./api";

const blankEmployee = {
  employee_code: "",
  employee_name: "",
  email: "",
  mobile: "",
  department: "",
  designation: "",
  status: "Active",
};

const today = new Date().toISOString().slice(0, 10);

const blankAttendance = {
  employee_id: "",
  attendance_date: today,
  check_in_time: "",
  check_out_time: "",
  attendance_status: "Present",
};

function App() {
  const [token, setToken] = useState(localStorage.getItem("attendance_token"));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("attendance_user") || "null"));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [history, setHistory] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [summary, setSummary] = useState(null);
  const [employeeForm, setEmployeeForm] = useState(blankEmployee);
  const [attendanceForm, setAttendanceForm] = useState(blankAttendance);
  const [editingId, setEditingId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [historyEmployeeId, setHistoryEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "Active"),
    [employees]
  );

  useEffect(() => {
    if (token) {
      loadAll();
    }
  }, [token]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [employeeRows, attendanceRows, dashboardData, summaryData] = await Promise.all([
        apiRequest(`/employees${buildQuery({ search })}`),
        apiRequest("/attendance"),
        apiRequest("/dashboard"),
        apiRequest(`/attendance/summary${buildQuery({ date: today })}`),
      ]);
      setEmployees(employeeRows);
      setAttendance(attendanceRows);
      setDashboard(dashboardData);
      setSummary(summaryData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      localStorage.setItem("attendance_token", data.token);
      localStorage.setItem("attendance_user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem("attendance_token");
    localStorage.removeItem("attendance_user");
    setToken(null);
    setUser(null);
  }

  async function submitEmployee(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiRequest(editingId ? `/employees/${editingId}` : "/employees", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(employeeForm),
      });
      setMessage(editingId ? "Employee updated successfully." : "Employee added successfully.");
      setEmployeeForm(blankEmployee);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  function editEmployee(employee) {
    setEmployeeForm({
      employee_code: employee.employee_code,
      employee_name: employee.employee_name,
      email: employee.email,
      mobile: employee.mobile,
      department: employee.department,
      designation: employee.designation,
      status: employee.status,
    });
    setEditingId(employee.employee_id);
    setActiveTab("employees");
  }

  async function deleteEmployee(employeeId) {
    if (!window.confirm("Delete this employee and related attendance records?")) return;
    setError("");
    setMessage("");
    try {
      await apiRequest(`/employees/${employeeId}`, { method: "DELETE" });
      setMessage("Employee deleted successfully.");
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitAttendance(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiRequest("/attendance", {
        method: "POST",
        body: JSON.stringify(attendanceForm),
      });
      setMessage("Attendance marked successfully.");
      setAttendanceForm({ ...blankAttendance, attendance_date: attendanceForm.attendance_date });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadHistory(employeeId) {
    setHistoryEmployeeId(employeeId);
    if (!employeeId) {
      setHistory([]);
      return;
    }
    try {
      setHistory(await apiRequest(`/attendance/employee/${employeeId}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function searchEmployees(event) {
    event.preventDefault();
    await loadAll();
  }

  if (!token) {
    return (
      <main className="login-screen">
        <section className="login-panel">
          <div>
            <p className="eyebrow">Attendance Management System</p>
            <h1>Sign in</h1>
            <p className="muted">Use admin / admin123 or a valid user from the MySQL users table.</p>
          </div>
          <form onSubmit={handleLogin} className="stack">
            <label>
              Username
              <input name="username" type="text" required autoComplete="username" placeholder="admin" />
            </label>
            <label>
              Password
              <input name="password" type="password" required autoComplete="current-password" placeholder="admin123" />
            </label>
            {error && <div className="alert error">{error}</div>}
            <button className="primary" type="submit">
              <BadgeCheck size={18} />
              Login
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Attendance</p>
          <h1>Management System</h1>
        </div>
        <nav>
          <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")}>
            <CalendarCheck size={18} />
            Dashboard
          </button>
          <button className={activeTab === "employees" ? "active" : ""} onClick={() => setActiveTab("employees")}>
            <Users size={18} />
            Employees
          </button>
          <button className={activeTab === "attendance" ? "active" : ""} onClick={() => setActiveTab("attendance")}>
            <Clock size={18} />
            Attendance
          </button>
        </nav>
        <button className="ghost" onClick={logout}>
          <LogOut size={18} />
          Logout {user?.username}
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeTab}</p>
            <h2>{activeTab === "dashboard" ? "Dashboard" : activeTab === "employees" ? "Employee Management" : "Attendance Management"}</h2>
          </div>
          <button className="secondary" onClick={loadAll} disabled={loading}>
            Refresh
          </button>
        </header>

        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}

        {activeTab === "dashboard" && (
          <DashboardView dashboard={dashboard} summary={summary} />
        )}

        {activeTab === "employees" && (
          <EmployeeView
            employees={employees}
            employeeForm={employeeForm}
            setEmployeeForm={setEmployeeForm}
            submitEmployee={submitEmployee}
            editingId={editingId}
            setEditingId={setEditingId}
            setSelectedEmployee={setSelectedEmployee}
            editEmployee={editEmployee}
            deleteEmployee={deleteEmployee}
            search={search}
            setSearch={setSearch}
            searchEmployees={searchEmployees}
          />
        )}

        {activeTab === "attendance" && (
          <AttendanceView
            employees={activeEmployees}
            attendance={attendance}
            attendanceForm={attendanceForm}
            setAttendanceForm={setAttendanceForm}
            submitAttendance={submitAttendance}
            summary={summary}
            history={history}
            historyEmployeeId={historyEmployeeId}
            loadHistory={loadHistory}
          />
        )}
      </section>

      {selectedEmployee && (
        <EmployeeDetails employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}
    </main>
  );
}

function DashboardView({ dashboard, summary }) {
  const stats = [
    ["Total Employees", dashboard?.total_employees ?? 0, <Users size={22} />],
    ["Active Employees", dashboard?.active_employees ?? 0, <UserRound size={22} />],
    ["Present Today", dashboard?.present_today ?? 0, <BadgeCheck size={22} />],
    ["Absent Today", dashboard?.absent_today ?? 0, <Clock size={22} />],
  ];

  return (
    <div className="content-grid">
      <section className="stats-grid">
        {stats.map(([label, value, icon]) => (
          <article className="stat-card" key={label}>
            <span>{icon}</span>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <h3>Department-wise Employee Count</h3>
        <div className="bars">
          {(dashboard?.department_counts || []).map((item) => (
            <div className="bar-row" key={item.department}>
              <span>{item.department}</span>
              <div>
                <i style={{ width: `${Math.max(item.total * 18, 18)}px` }} />
              </div>
              <b>{item.total}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Attendance Summary</h3>
        <div className="summary-list">
          {["Present", "Absent", "Half Day", "Leave", "Not Marked"].map((key) => (
            <div key={key}>
              <span>{key}</span>
              <strong>{summary?.[key] ?? 0}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmployeeView(props) {
  const {
    employees,
    employeeForm,
    setEmployeeForm,
    submitEmployee,
    editingId,
    setEditingId,
    setSelectedEmployee,
    editEmployee,
    deleteEmployee,
    search,
    setSearch,
    searchEmployees,
  } = props;

  return (
    <div className="split-layout">
      <section className="panel">
        <h3>{editingId ? "Edit Employee" : "Add Employee"}</h3>
        <form className="form-grid" onSubmit={submitEmployee}>
          <Input label="Employee ID" value={employeeForm.employee_code} onChange={(value) => setEmployeeForm({ ...employeeForm, employee_code: value })} />
          <Input label="Employee Name" value={employeeForm.employee_name} onChange={(value) => setEmployeeForm({ ...employeeForm, employee_name: value })} />
          <Input label="Email Address" type="email" value={employeeForm.email} onChange={(value) => setEmployeeForm({ ...employeeForm, email: value })} />
          <Input label="Mobile Number" value={employeeForm.mobile} onChange={(value) => setEmployeeForm({ ...employeeForm, mobile: value })} />
          <Input label="Department" value={employeeForm.department} onChange={(value) => setEmployeeForm({ ...employeeForm, department: value })} />
          <Input label="Designation" value={employeeForm.designation} onChange={(value) => setEmployeeForm({ ...employeeForm, designation: value })} />
          <label>
            Status
            <select value={employeeForm.status} onChange={(event) => setEmployeeForm({ ...employeeForm, status: event.target.value })}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <div className="button-row">
            <button className="primary" type="submit">
              <Plus size={17} />
              {editingId ? "Update" : "Add"}
            </button>
            {editingId && (
              <button className="secondary" type="button" onClick={() => { setEditingId(null); setEmployeeForm(blankEmployee); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading">
          <h3>Employees</h3>
          <form className="search" onSubmit={searchEmployees}>
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" />
          </form>
        </div>
        <DataTable
          columns={["ID", "Name", "Department", "Designation", "Status", "Actions"]}
          rows={employees.map((employee) => [
            employee.employee_code,
            employee.employee_name,
            employee.department,
            employee.designation,
            <span className={`pill ${employee.status.toLowerCase()}`} key="status">{employee.status}</span>,
            <ActionButtons
              key="actions"
              employee={employee}
              setSelectedEmployee={setSelectedEmployee}
              editEmployee={editEmployee}
              deleteEmployee={deleteEmployee}
            />,
          ])}
        />
      </section>
    </div>
  );
}

function AttendanceView(props) {
  const {
    employees,
    attendance,
    attendanceForm,
    setAttendanceForm,
    submitAttendance,
    summary,
    history,
    historyEmployeeId,
    loadHistory,
  } = props;
  const needsTime = ["Present", "Half Day"].includes(
  attendanceForm?.attendance_status
);
  return (
    <div className="split-layout">
      <section className="panel">
        <h3>Mark Attendance</h3>
        <form className="form-grid" onSubmit={submitAttendance}>
          <label>
            Employee ID
            <select required value={attendanceForm.employee_id} onChange={(event) => setAttendanceForm({ ...attendanceForm, employee_id: event.target.value })}>
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.employee_id} value={employee.employee_id}>
                  {employee.employee_code} - {employee.employee_name}
                </option>
              ))}
            </select>
          </label>
          <Input label="Attendance Date" type="date" value={attendanceForm.attendance_date} onChange={(value) => setAttendanceForm({ ...attendanceForm, attendance_date: value })} />
          {needsTime && (
  <>
          <Input label="Check-In Time" type="time" value={attendanceForm.check_in_time} onChange={(value) => setAttendanceForm({ ...attendanceForm, check_in_time: value,})} />

          <Input label="Check-Out Time" type="time" value={attendanceForm.check_out_time} onChange={(value) => setAttendanceForm({ ...attendanceForm, check_out_time: value,})} />
  </>
)}
          <label>
            Attendance Status
            <select value={attendanceForm.attendance_status} onChange={(event) => setAttendanceForm({ ...attendanceForm, attendance_status: event.target.value })}>
              <option>Present</option>
              <option>Absent</option>
              <option>Half Day</option>
              <option>Leave</option>
            </select>
          </label>
          <button className="primary" type="submit">
            <CalendarCheck size={17} />
            Mark Attendance
          </button>
        </form>

        <h3>Summary</h3>
        <div className="summary-list compact">
          {["Present", "Absent", "Half Day", "Leave", "Not Marked"].map((key) => (
            <div key={key}>
              <span>{key}</span>
              <strong>{summary?.[key] ?? 0}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading">
          <h3>Attendance Records</h3>
          <select value={historyEmployeeId} onChange={(event) => loadHistory(event.target.value)}>
            <option value="">Employee-wise history</option>
            {employees.map((employee) => (
              <option key={employee.employee_id} value={employee.employee_id}>
                {employee.employee_code} - {employee.employee_name}
              </option>
            ))}
          </select>
        </div>
        <DataTable
          columns={["Date", "Employee", "Check-In", "Check-Out", "Status"]}
          rows={(historyEmployeeId ? history : attendance).map((row) => [
            row.attendance_date,
            `${row.employee_code} - ${row.employee_name}`,
            row.check_in_time || "-",
            row.check_out_time || "-",
            <span className="pill active" key="status">{row.attendance_status}</span>,
          ])}
        />
      </section>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ActionButtons({ employee, setSelectedEmployee, editEmployee, deleteEmployee }) {
  return (
    <div className="icon-actions">
      <button title="View details" onClick={() => setSelectedEmployee(employee)}>
        <UserRound size={16} />
      </button>
      <button title="Edit employee" onClick={() => editEmployee(employee)}>
        <Edit3 size={16} />
      </button>
      <button title="Delete employee" onClick={() => deleteEmployee(employee.employee_id)}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty">No records found.</td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeDetails({ employee, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-heading">
          <h3>Employee Details</h3>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
        <dl className="details">
          <dt>Employee ID</dt><dd>{employee.employee_code}</dd>
          <dt>Name</dt><dd>{employee.employee_name}</dd>
          <dt>Email</dt><dd>{employee.email}</dd>
          <dt>Mobile</dt><dd>{employee.mobile}</dd>
          <dt>Department</dt><dd>{employee.department}</dd>
          <dt>Designation</dt><dd>{employee.designation}</dd>
          <dt>Status</dt><dd>{employee.status}</dd>
        </dl>
      </section>
    </div>
  );
}

export default App;
