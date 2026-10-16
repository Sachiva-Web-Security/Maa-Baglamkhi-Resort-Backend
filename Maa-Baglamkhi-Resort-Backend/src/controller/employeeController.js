const db = require("../config/db");
const bcrypt = require("bcryptjs");

const ROLE_NAME_TO_ID = {
  admin: 1,
  manager: 2,
  reception: 3,
  accounts: 4,
  housekeeping: 5,
  waiter: 6,
  kitchen: 7,
};

// `staff` is a generic label, not a real row in `roles`. Map it to the
// least-privileged real role so a mislabelled account cannot gain access.
const STAFF_ROLE_ID = 3;

const DEFAULT_PASSWORD = "password";

const DAY_STATUS_MULTIPLIER = {
  present: 1,
  absent: 0,
  late: 0.5,
  half_day: 0.5,
  on_leave: 0,
  holiday: 1,
  week_off: 1,
};

function normalizeRoleName(raw) {
  const base = String(raw == null ? "" : raw).trim().toLowerCase();
  if (base === "receptionist") return "reception";
  if (base === "accountant") return "accounts";
  if (base === "staff") return String(STAFF_ROLE_ID);
  return base;
}

function resolveRoleId(raw) {
  if (Number.isInteger(raw) && raw > 0) return raw;
  const base = String(raw == null ? "" : raw).trim().toLowerCase();
  if (base in ROLE_NAME_TO_ID) return ROLE_NAME_TO_ID[base];
  const asNumber = Number(base);
  if (Number.isInteger(asNumber) && asNumber > 0) return asNumber;
  return STAFF_ROLE_ID;
}

function resolveRoleName(roleId, name) {
  if (name) return name;
  if (String(roleId) === "1") return "admin";
  if (String(roleId) === "2") return "manager";
  if (String(roleId) === "3") return "reception";
  if (String(roleId) === "4") return "accounts";
  if (String(roleId) === "5") return "housekeeping";
  if (String(roleId) === "6") return "waiter";
  if (String(roleId) === "7") return "kitchen";
  return "staff";
}

const EMPLOYEE_COLUMNS = [
  "employee_code",
  "first_name",
  "last_name",
  "phone",
  "emergency_contact",
  "address",
  "aadhaar_no",
  "pan_no",
  "bank_account",
  "bank_ifsc",
  "base_salary",
];

const LIST_QUERY = `
SELECT e.id AS employee_id,
       e.employee_code,
       COALESCE(e.first_name, '') AS first_name,
       e.last_name,
       d.name AS designation,
       dep.name AS department,
       e.date_of_joining,
       e.date_of_leaving,
       e.phone AS employee_phone,
       e.address AS employee_address,
       e.aadhaar_no,
       e.pan_no,
       e.bank_account,
       e.bank_ifsc,
       e.base_salary,
       e.is_active,
       e.created_at AS employee_created_at,
       e.user_id,
       u.id,
       u.name AS username,
       u.email,
       u.phone,
       u.avatar_url,
       u.status AS user_status,
       u.last_login_at,
       u.created_at AS user_created_at,
       COALESCE(r.name, 'staff') AS role
  FROM employees e
  LEFT JOIN users u ON u.id = e.user_id
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN designations d ON d.id = e.designation_id
  LEFT JOIN departments dep ON dep.id = e.department_id
  ORDER BY e.first_name, e.last_name`;

async function nextEmployeeCode() {
  try {
    const [rows] = await db.query(
      "SELECT employee_code FROM employees WHERE employee_code IS NOT NULL ORDER BY id DESC LIMIT 1"
    );
    const last = rows && rows[0] && rows[0].employee_code;
    const match = last && String(last).match(/(\d+)$/);
    const next = match ? Number(match[1]) + 1 : 1;
    return `EMP-${String(next).padStart(4, "0")}`;
  } catch (err) {
    return `EMP-${Date.now()}`;
  }
}

async function ensureEmployeeForUser(userId) {
  const [userRows] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
  const user = userRows && userRows[0];
  if (!user) return null;

  const [empRows] = await db.query("SELECT id FROM employees WHERE user_id = ? LIMIT 1", [userId]);
  if (empRows && empRows[0]) return empRows[0].id;

  const parts = String(user.name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "Staff";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  const code = await nextEmployeeCode();

  await db.query(
    `INSERT INTO employees (user_id, employee_code, first_name, last_name, phone, base_salary, is_active)
     VALUES (?, ?, ?, ?, ?, 0.00, 1)`,
    [userId, code, firstName, lastName, user.phone || null]
  );

  const [inserted] = await db.query("SELECT id FROM employees WHERE user_id = ? LIMIT 1", [userId]);
  return (inserted && inserted[0] && inserted[0].id) || null;
}

// One user record + one employee record. Users are the login accounts,
// employees hold the payroll/attendance fields (base_salary, department,
// designation, bank details). Creating both keeps the staff list, attendance
// and salary modules in step instead of three half-populated tables.
async function createUserRecord({ name, email, password, role, phone, department, designation, baseSalary }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const roleId = resolveRoleId(role);

  const [result] = await db.query(
    "INSERT INTO users (name, email, password_hash, role_id, phone, status) VALUES (?, ?, ?, ?, ?, 'active')",
    [name, email, hashedPassword, roleId, phone || null]
  );
  const userId = result && result.insertId;

  await db.query(
    `INSERT INTO employees (user_id, employee_code, first_name, last_name, department_id, designation_id,
                            phone, base_salary, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      userId,
      await nextEmployeeCode(),
      name.split(/\s+/)[0] || "Staff",
      null,
      department ? Number(department) : null,
      designation ? Number(designation) : null,
      phone || null,
      Number(baseSalary || 0),
    ]
  );

  return { userId, password: password, plainPassword: DEFAULT_PASSWORD };
}

// CREATE /api/employees — admin only
exports.createEmployee = async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || body.fullName || body.first_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = body.role ?? body.role_name;

  if (!name) {
    return res.status(400).json({ message: "Employee name is required" });
  }
  if (!role) {
    return res.status(400).json({ message: "Role is required" });
  }
  if (email) {
    const [existing] = await db.query("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [email]);
    if (existing && existing[0]) {
      return res.status(400).json({ message: "A user with this email already exists" });
    }
  }

  const password = body.password || DEFAULT_PASSWORD;

  try {
    const { userId } = await createUserRecord({
      name,
      email,
      password,
      role,
      phone: body.phone,
      department: body.department_id ?? body.department,
      designation: body.designation_id ?? body.designation,
      baseSalary: body.base_salary ?? body.salary,
    });

    const [rows] = await db.query(
      LIST_QUERY + " WHERE u.id = ? LIMIT 1",
      [userId]
    );
    return res.status(201).json({
      message: "Employee created successfully",
      defaultPassword: DEFAULT_PASSWORD,
      employee: rows && rows[0] ? rows[0] : { id: userId, name },
    });
  } catch (err) {
    console.error("createEmployee error:", err.message || err);
    return res.status(500).json({ message: "Failed to create employee", error: err.message });
  }
};

// LIST /api/employees — admin only. Returns every employee, including
// accounts that have a users row but no employees row yet.
exports.listEmployees = async (req, res) => {
  try {
    const params = req.query ? req.query : {};
    const department = params.department;
    const search = String(params.q || params.search || "").trim();
    const activeOnly = String(params.active ?? "").toLowerCase();

    let sql = LIST_QUERY;
    const where = [];
    const values = [];

    if (department && department !== "all" && department !== "All Departments") {
      where.push("dep.name = ?");
      values.push(String(department));
    }
    if (activeOnly === "1" || activeOnly === "true") {
      where.push("e.is_active = 1");
    }
    if (search) {
      where.push("(e.first_name LIKE ? OR e.employee_code LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
      const like = `%${search}%`;
      values.push(like, like, like, like);
    }
    if (where.length) sql += " WHERE " + where.join(" AND ");

    const [rows] = await db.query(sql, values);
    return res.json(rows || []);
  } catch (err) {
    console.error("listEmployees error:", err.message || err);
    return res.status(500).json({ message: "Failed to fetch employees", error: err.message });
  }
};

exports.getEmployee = async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ message: "Employee id required" });

  try {
    const [rows] = await db.query(LIST_QUERY + " WHERE e.id = ? OR u.id = ? LIMIT 1", [id, id]);
    const employee = rows && rows[0];
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    return res.json(employee);
  } catch (err) {
    console.error("getEmployee error:", err.message || err);
    return res.status(500).json({ message: "Failed to fetch employee", error: err.message });
  }
};

// UPDATE /api/employees/:id — admin only. Handles both employees.id and
// users.id, because the salary and attendance modules address staff by user id.
exports.updateEmployee = async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  if (!id) return res.status(400).json({ message: "Employee id required" });

  try {
    let [empRows] = await db.query("SELECT id, user_id FROM employees WHERE id = ? LIMIT 1", [id]);
    if (!empRows || !empRows[0]) {
      const [userRows] = await db.query("SELECT id FROM users WHERE id = ? LIMIT 1", [id]);
      if (!userRows || !userRows[0]) {
        return res.status(404).json({ message: "Employee not found" });
      }
      empRows = await db.query("SELECT id, user_id FROM employees WHERE user_id = ? LIMIT 1", [id]);
    }
    const employee = empRows && empRows[0];
    if (!employee) {
      const ensured = await ensureEmployeeForUser(id);
      if (!ensured) return res.status(404).json({ message: "Employee not found" });
      empRows = await db.query("SELECT id, user_id FROM employees WHERE id = ? LIMIT 1", [ensured]);
      const retried = empRows && empRows[0];
      if (!retried) return res.status(404).json({ message: "Employee not found" });
    }
    const empId = employee.id;
    const userId = employee.user_id;

    const assignments = [];
    const values = [];
    for (const col of EMPLOYEE_COLUMNS) {
      if (body[col] !== undefined) {
        assignments.push(`${col} = ?`);
        values.push(col === "base_salary" ? Number(body[col] || 0) : body[col]);
      }
    }
    if (body.base_salary !== undefined && body.salary !== undefined) {
      // fall through: base_salary handled above
    } else if (body.salary !== undefined) {
      assignments.push("base_salary = ?");
      values.push(Number(body.salary || 0));
    }
    if (body.designation !== undefined && body.designation_id === undefined) {
      assignments.push("designation_id = ?");
      values.push(body.designation ? Number(body.designation) : null);
    }
    if (body.department !== undefined && body.department_id === undefined) {
      assignments.push("department_id = ?");
      values.push(body.department ? Number(body.department) : null);
    }
    if (body.employee_code !== undefined) {
      assignments.push("employee_code = ?");
      values.push(body.employee_code);
    }

    if (userId) {
      if (body.name !== undefined) {
        const [first, ...rest] = String(body.name).trim().split(/\s+/).filter(Boolean);
        assignments.push("first_name = ?");
        values.push(first || "Staff");
        assignments.push("last_name = ?");
        values.push(rest.join(" ") || null);
      }
    }

    if (assignments.length) {
      assignments.push("updated_at = NOW()");
      await db.query(
        `UPDATE employees SET ${assignments.join(", ")} WHERE id = ?`,
        [...values, empId]
      );
    }

    const userAssignments = [];
    const userValues = [];
    if (userId) {
      if (body.name !== undefined) {
        userAssignments.push("name = ?");
        userValues.push(String(body.name).trim());
      }
      if (body.phone !== undefined) {
        userAssignments.push("phone = ?");
        userValues.push(body.phone);
      }
      if (body.email !== undefined && body.email) {
        const [dup] = await db.query(
          "SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ? LIMIT 1",
          [body.email, userId]
        );
        if (dup && dup[0]) {
          return res.status(400).json({ message: "Another user already uses this email" });
        }
        userAssignments.push("email = ?");
        userValues.push(String(body.email).trim().toLowerCase());
      }
      if (body.role !== undefined) {
        userAssignments.push("role_id = ?");
        userValues.push(resolveRoleId(body.role));
      }
      if (body.status !== undefined) {
        userAssignments.push("status = ?");
        userValues.push(String(body.status).toLowerCase());
      }
      if (body.password) {
        userAssignments.push("password_hash = ?");
        userValues.push(await bcrypt.hash(String(body.password), 10));
      }
      if (userAssignments.length) {
        userAssignments.push("updated_at = NOW()");
        userValues.push(userId);
        await db.query(`UPDATE users SET ${userAssignments.join(", ")} WHERE id = ?`, userValues);
      }
    }

    const [rows] = await db.query(LIST_QUERY + " WHERE e.id = ? LIMIT 1", [empId]);
    return res.json({ message: "Employee updated successfully", employee: rows && rows[0] ? rows[0] : null });
  } catch (err) {
    console.error("updateEmployee error:", err.message || err);
    return res.status(500).json({ message: "Failed to update employee", error: err.message });
  }
};

// DELETE /api/employees/:id — admin only. Deactivates instead of deleting:
// attendance_records and salary_payments reference employees.id, so removing
// the row would orphan payroll history.
exports.deactivateEmployee = async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ message: "Employee id required" });

  try {
    let [empRows] = await db.query("SELECT id, user_id FROM employees WHERE id = ? LIMIT 1", [id]);
    if (!empRows || !empRows[0]) {
      const [userRows] = await db.query("SELECT id FROM users WHERE id = ? LIMIT 1", [id]);
      if (!userRows || !userRows[0]) return res.status(404).json({ message: "Employee not found" });
      empRows = await db.query("SELECT id, user_id FROM employees WHERE user_id = ? LIMIT 1", [id]);
    }
    const employee = empRows && empRows[0];
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    if (Number(req.user && req.user.id) === Number(employee.user_id)) {
      return res.status(400).json({ message: "You cannot deactivate your own account" });
    }

    await db.query("UPDATE employees SET is_active = 0, updated_at = NOW() WHERE id = ?", [employee.id]);
    if (employee.user_id) {
      await db.query("UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = ?", [
        employee.user_id,
      ]);
    }

    return res.json({ message: "Employee deactivated", employeeId: employee.id });
  } catch (err) {
    console.error("deactivateEmployee error:", err.message || err);
    return res.status(500).json({ message: "Failed to deactivate employee", error: err.message });
  }
};

// /api/employees/departments and /api/employees/designations — feed the
// filters and forms on the Attendance and Salary screens.
exports.listDepartments = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name FROM departments ORDER BY name");
    return res.json(rows || []);
  } catch (err) {
    console.error("listDepartments error:", err.message || err);
    return res.status(500).json({ message: "Failed to fetch departments" });
  }
};

exports.listDesignations = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT d.id, d.name, d.department_id, dep.name AS department_name FROM designations d LEFT JOIN departments dep ON dep.id = d.department_id ORDER BY d.name"
    );
    return res.json(rows || []);
  } catch (err) {
    console.error("listDesignations error:", err.message || err);
    return res.status(500).json({ message: "Failed to fetch designations" });
  }
};

// /api/employees/stats — counts for the attendance summary cards.
exports.getEmployeeStats = async (req, res) => {
  const date = String(req.query && req.query.date || "").slice(0, 10);
  try {
    const [total] = await db.query("SELECT COUNT(*) AS total FROM employees WHERE is_active = 1");
    const [byStatus] = date
      ? await db.query(
          `SELECT e.department_id, COALESCE(d.name, 'Unassigned') AS department,
                  e.designation_id, COALESCE(g.name, 'Unassigned') AS designation,
                  COALESCE(r.name, 'staff') AS role,
                  ar.status, ar.salary_amount
           FROM employees e
           LEFT JOIN attendance_records ar ON ar.employee_id = e.id AND ar.date = ?
           LEFT JOIN departments d ON d.id = e.department_id
           LEFT JOIN designations g ON g.id = e.designation_id
           LEFT JOIN users u ON u.id = e.user_id
           LEFT JOIN roles r ON r.id = u.role_id
           WHERE e.is_active = 1`,
          [date]
        )
      : await db.query(
          `SELECT e.department_id, COALESCE(d.name, 'Unassigned') AS department,
                  e.designation_id, COALESCE(g.name, 'Unassigned') AS designation,
                  COALESCE(r.name, 'staff') AS role,
                  NULL AS status, NULL AS salary_amount
           FROM employees e
           LEFT JOIN departments d ON d.id = e.department_id
           LEFT JOIN designations g ON g.id = e.designation_id
           LEFT JOIN users u ON u.id = e.user_id
           LEFT JOIN roles r ON r.id = u.role_id
           WHERE e.is_active = 1`
        );

    const rows = byStatus || [];
    const tally = { present: 0, absent: 0, late: 0, on_leave: 0, half_day: 0 };
    let totalSalary = 0;
    for (const row of rows) {
      const status = String(row.status || "").toLowerCase();
      if (tally.hasOwnProperty(status)) tally[status] += 1;
      totalSalary += Number(row.salary_amount || 0);
    }

    return res.json({
      total: Number((total && total[0] && total[0].total) || 0),
      date: date || null,
      ...tally,
      totalSalary: Number(totalSalary.toFixed(2)),
    });
  } catch (err) {
    console.error("getEmployeeStats error:", err.message || err);
    return res.status(500).json({ message: "Failed to fetch employee stats" });
  }
};

exports.normalizeRoleName = normalizeRoleName;
exports.resolveRoleId = resolveRoleId;
exports.ensureEmployeeForUser = ensureEmployeeForUser;
