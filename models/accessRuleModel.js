const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS access_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      module VARCHAR(100) NOT NULL,
      role VARCHAR(100) NOT NULL,
      branch_id INT DEFAULT NULL,
      can_view TINYINT(1) NOT NULL DEFAULT 1,
      can_create TINYINT(1) NOT NULL DEFAULT 0,
      can_edit TINYINT(1) NOT NULL DEFAULT 0,
      can_delete TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_rule (module, role, branch_id)
    )
  `);
};

const mapRow = (r) => ({
  id: r.id,
  module: r.module || "",
  role: r.role || "",
  branch_id: r.branch_id,
  branch_name: r.branch_name || "",
  can_view: Number(r.can_view) === 1,
  can_create: Number(r.can_create) === 1,
  can_edit: Number(r.can_edit) === 1,
  can_delete: Number(r.can_delete) === 1,
});

const sanitize = (body) => {
  const module = String(body?.module || "").trim();
  const role = String(body?.role || "").trim();
  if (!module) throw new Error("Module is required");
  if (!role) throw new Error("Role is required");
  const branchRaw = body?.branch_id;
  const branch_id =
    branchRaw === null || branchRaw === undefined || branchRaw === "" || branchRaw === "all"
      ? null
      : Number(branchRaw);
  return {
    module,
    role,
    branch_id,
    can_view: body?.can_view === false ? 0 : 1,
    can_create: body?.can_create === true || body?.can_create === 1 ? 1 : 0,
    can_edit: body?.can_edit === true || body?.can_edit === 1 ? 1 : 0,
    can_delete: body?.can_delete === true || body?.can_delete === 1 ? 1 : 0,
  };
};

const list = async ({ module = "", role = "", branch_id = "" } = {}) => {
  const where = [];
  const params = [];
  if (module) { where.push("ar.module = ?"); params.push(module); }
  if (role) { where.push("ar.role = ?"); params.push(role); }
  if (branch_id && branch_id !== "all") {
    where.push("ar.branch_id = ?");
    params.push(Number(branch_id));
  }
  const sql = `
    SELECT ar.*, b.name AS branch_name
      FROM access_rules ar
      LEFT JOIN branches b ON b.id = ar.branch_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ar.id DESC
  `;
  const rows = await runQuery(sql, params);
  return rows.map(mapRow);
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO access_rules
       (module, role, branch_id, can_view, can_create, can_edit, can_delete)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.module, p.role, p.branch_id, p.can_view, p.can_create, p.can_edit, p.can_delete],
  );
  const rows = await runQuery(
    `SELECT ar.*, b.name AS branch_name
       FROM access_rules ar LEFT JOIN branches b ON b.id = ar.branch_id
      WHERE ar.id = ?`,
    [result.insertId],
  );
  return mapRow(rows[0]);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE access_rules
        SET module = ?, role = ?, branch_id = ?,
            can_view = ?, can_create = ?, can_edit = ?, can_delete = ?
      WHERE id = ?`,
    [p.module, p.role, p.branch_id, p.can_view, p.can_create, p.can_edit, p.can_delete, id],
  );
  const rows = await runQuery(
    `SELECT ar.*, b.name AS branch_name
       FROM access_rules ar LEFT JOIN branches b ON b.id = ar.branch_id
      WHERE ar.id = ?`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const remove = async (id) => {
  await runQuery("DELETE FROM access_rules WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove };
