const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const STATUSES = ["Available", "Occupied", "Cleaning", "Maintenance", "Blocked"];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fo_rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      room_no VARCHAR(50) NOT NULL UNIQUE,
      room_type_id INT DEFAULT NULL,
      description VARCHAR(500) DEFAULT NULL,
      floor VARCHAR(50) DEFAULT NULL,
      room_status VARCHAR(50) NOT NULL DEFAULT 'Available',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE SET NULL
    )
  `);
};

const mapRow = (r) => ({
  id: r.id,
  room_no: r.room_no || "",
  room_type_id: r.room_type_id,
  room_type_name: r.room_type_name || "",
  description: r.description || "",
  floor: r.floor || "",
  room_status: r.room_status || "Available",
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const room_no = String(body?.room_no || "").trim();
  if (!room_no) throw new Error("Room number is required");
  const status = String(body?.room_status || "Available").trim();
  if (!STATUSES.includes(status)) {
    throw new Error(`Invalid status (must be one of: ${STATUSES.join(", ")})`);
  }
  return {
    room_no,
    room_type_id: body?.room_type_id ? Number(body.room_type_id) : null,
    description: String(body?.description || "").trim() || null,
    floor: String(body?.floor || "").trim() || null,
    room_status: status,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const list = async () => {
  const rows = await runQuery(`
    SELECT r.*, rt.name AS room_type_name
      FROM fo_rooms r
      LEFT JOIN room_types rt ON rt.id = r.room_type_id
      ORDER BY r.id ASC
  `);
  return rows.map(mapRow);
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO fo_rooms
       (room_no, room_type_id, description, floor, room_status, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [p.room_no, p.room_type_id, p.description, p.floor, p.room_status, p.is_active],
  );
  const rows = await runQuery(
    `SELECT r.*, rt.name AS room_type_name
       FROM fo_rooms r LEFT JOIN room_types rt ON rt.id = r.room_type_id
      WHERE r.id = ?`,
    [result.insertId],
  );
  return mapRow(rows[0]);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE fo_rooms
        SET room_no = ?, room_type_id = ?, description = ?,
            floor = ?, room_status = ?, is_active = ?
      WHERE id = ?`,
    [p.room_no, p.room_type_id, p.description, p.floor, p.room_status, p.is_active, id],
  );
  const rows = await runQuery(
    `SELECT r.*, rt.name AS room_type_name
       FROM fo_rooms r LEFT JOIN room_types rt ON rt.id = r.room_type_id
      WHERE r.id = ?`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const remove = async (id) => {
  await runQuery("DELETE FROM fo_rooms WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove, STATUSES };
