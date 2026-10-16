const db = require("../config/db");
const PermissionsModel = require("../models/PermissionsModel");
const RolesModel = require("../models/RolesModel");

const SYSTEM_ROLE_IDS = [1, 2, 3, 4, 5, 6, 7];

function displayForRole(role) {
  const name = String((role && role.name) || "").toLowerCase();
  const fallback = {
    admin: "Administrator",
    manager: "Manager",
    reception: "Receptionist",
    accounts: "Accounts",
    housekeeping: "Housekeeping",
    waiter: "Waiter",
    kitchen: "Kitchen Staff",
  };
  return (role && role.display_name) || fallback[name] || (role && role.name) || "Role";
}

const ROLE_LIST_QUERY = `
SELECT r.id, r.name, r.display_name, r.description, r.is_system, r.created_at,
       COUNT(rp.permission_id) AS permission_count
  FROM roles r
  LEFT JOIN role_permissions rp ON rp.role_id = r.id
  GROUP BY r.id
  ORDER BY r.id`;

// GET /api/roles
exports.listRoles = async (req, res) => {
  try {
    await db.query("SELECT COUNT(*) FROM roles").catch(() => null);
    const [rows] = await db.query(ROLE_LIST_QUERY);
    return res.json((rows || []).map((role) => ({ ...role, display_name: displayForRole(role) })));
  } catch (err) {
    console.error("listRoles error:", err.message || err);
    return res.status(500).json({ message: "Failed to fetch roles" });
  }
};

exports.getRole = async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ message: "Role id required" });

  try {
    const [rows] = await db.query("SELECT * FROM roles WHERE id = ? LIMIT 1", [id]);
    const role = rows && rows[0];
    if (!role) return res.status(404).json({ message: "Role not found" });
    return res.json({ ...role, display_name: displayForRole(role) });
  } catch (err) {
    console.error("getRole error:", err.message || err);
    return res.status(500).json({ message: "Failed to fetch role" });
  }
};

// POST /api/roles — admin only
exports.createRole = async (req, res) => {
  const { name, display_name, description } = req.body || {};
  const normalizedName = String(name || "").trim().toLowerCase().replace(/\s+/g, "_");

  if (!normalizedName) {
    return res.status(400).json({ message: "Role name is required" });
  }
  if (!/^[a-z0-9_]+$/.test(normalizedName)) {
    return res.status(400).json({ message: "Role name must be lowercase letters, numbers and underscores" });
  }

  try {
    const [existing] = await db.query("SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1", [
      normalizedName,
    ]);
    if (existing && existing[0]) {
      return res.status(400).json({ message: "A role with this name already exists" });
    }

    await db.query(
      "INSERT INTO roles (name, display_name, description) VALUES (?, ?, ?)",
      [normalizedName, display_name || normalizedName, description || null]
    );

    const [rows] = await db.query("SELECT * FROM roles WHERE name = ? LIMIT 1", [normalizedName]);
    const role = rows && rows[0];
    return res.status(201).json({ message: "Role created", role: role ? { ...role, display_name: displayForRole(role) } : null });
  } catch (err) {
    console.error("createRole error:", err.message || err);
    return res.status(500).json({ message: "Failed to create role", error: err.message });
  }
};

// PATCH /api/roles/:id — admin only. System roles keep their `name` so the
// existing role guards do not stop matching them.
exports.updateRole = async (req, res) => {
  const id = req.params.id;
  const { display_name, description, name } = req.body || {};
  if (!id) return res.status(400).json({ message: "Role id required" });

  try {
    const [rows] = await db.query("SELECT * FROM roles WHERE id = ? LIMIT 1", [id]);
    const role = rows && rows[0];
    if (!role) return res.status(404).json({ message: "Role not found" });

    if (role.is_system && name && String(name).toLowerCase() !== role.name) {
      return res.status(400).json({ message: "System role names cannot be changed" });
    }

    const assignments = [];
    const values = [];
    if (display_name !== undefined) {
      assignments.push("display_name = ?");
      values.push(display_name);
    }
    if (description !== undefined) {
      assignments.push("description = ?");
      values.push(description);
    }
    if (name && role.is_system !== 1) {
      assignments.push("name = ?");
      values.push(String(name).trim().toLowerCase());
    }

    if (assignments.length) {
      await db.query(`UPDATE roles SET ${assignments.join(", ")} WHERE id = ?`, [...values, id]);
    }

    const [updated] = await db.query("SELECT * FROM roles WHERE id = ? LIMIT 1", [id]);
    const result = updated && updated[0];
    return res.json({ message: "Role updated", role: result ? { ...result, display_name: displayForRole(result) } : role });
  } catch (err) {
    console.error("updateRole error:", err.message || err);
    return res.status(500).json({ message: "Failed to update role", error: err.message });
  }
};

exports.deleteRole = async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ message: "Role id required" });

  try {
    const [rows] = await db.query("SELECT * FROM roles WHERE id = ? LIMIT 1", [id]);
    const role = rows && rows[0];
    if (!role) return res.status(404).json({ message: "Role not found" });
    if (role.is_system) {
      return res.status(400).json({ message: "System roles cannot be deleted" });
    }
    if (Number(id) === 1) {
      return res.status(400).json({ message: "The admin role cannot be deleted" });
    }

    const [users] = await db.query("SELECT COUNT(*) AS total FROM users WHERE role_id = ?", [id]);
    if (users && users[0] && users[0].total > 0) {
      return res.status(400).json({
        message: `This role is assigned to ${users[0].total} user(s); reassign them first`,
      });
    }

    await db.query("DELETE FROM role_permissions WHERE role_id = ?", [id]);
    await db.query("DELETE FROM roles WHERE id = ?", [id]);
    return res.json({ message: "Role deleted" });
  } catch (err) {
    console.error("deleteRole error:", err.message || err);
    return res.status(500).json({ message: "Failed to delete role", error: err.message });
  }
};

// GET /api/roles/:id/permissions — ids of the role's granted permissions.
exports.getRolePermissions = async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ message: "Role id required" });

  try {
    const [rows] = await db.query(
      "SELECT permission_id FROM role_permissions WHERE role_id = ?",
      [id]
    );
    return res.json({ roleId: Number(id), permissionIds: (rows || []).map((r) => Number(r.permission_id)) });
  } catch (err) {
    console.error("getRolePermissions error:", err.message || err);
    return res.status(500).json({ message: "Failed to fetch role permissions" });
  }
};

// PUT /api/roles/:id/permissions — admin only. Replaces the role's grants.
exports.setRolePermissions = async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const permissionIds = Array.isArray(body.permissionIds) ? body.permissionIds : null;

  if (!id) return res.status(400).json({ message: "Role id required" });
  if (!permissionIds) {
    return res.status(400).json({ message: "permissionIds array is required" });
  }

  try {
    const [roleRows] = await db.query("SELECT id FROM roles WHERE id = ? LIMIT 1", [id]);
    if (!roleRows || !roleRows[0]) {
      return res.status(404).json({ message: "Role not found" });
    }

    const cleaned = [...new Set(permissionIds.map((value) => Number(value)).filter((value) => value > 0))];

    if (cleaned.length) {
      const [permRows] = await db.query(
        `SELECT id FROM permissions WHERE id IN (${cleaned.map(() => "?").join(",")})`,
        cleaned
      );
      const valid = new Set((permRows || []).map((row) => Number(row.id)));
      const missing = cleaned.filter((value) => !valid.has(value));
      if (missing.length) {
        return res.status(400).json({
          message: `Unknown permission ids: ${missing.join(", ")}`,
        });
      }
    }

    await db.query("DELETE FROM role_permissions WHERE role_id = ?", [id]);
    for (const permissionId of cleaned) {
      try {
        await db.query(
          "INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
          [id, permissionId]
        );
      } catch (err) {
        if (!String(err.message || "").includes("already")) {
          throw err;
        }
      }
    }

    return res.json({
      message: "Role permissions updated",
      roleId: Number(id),
      permissionIds: cleaned,
    });
  } catch (err) {
    console.error("setRolePermissions error:", err.message || err);
    return res.status(500).json({ message: "Failed to update role permissions", error: err.message });
  }
};

// GET /api/permissions — the full permission catalogue, grouped by module.
exports.listPermissions = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM permissions ORDER BY module, action");
    return res.json(rows || []);
  } catch (err) {
    console.error("listPermissions error:", err.message || err);
    return res.status(500).json({ message: "Failed to fetch permissions" });
  }
};

exports.SYSTEM_ROLE_IDS = SYSTEM_ROLE_IDS;
