const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS email_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      host VARCHAR(255) DEFAULT NULL,
      sender_name VARCHAR(255) DEFAULT NULL,
      sender_email VARCHAR(191) DEFAULT NULL,
      sender_password VARCHAR(255) DEFAULT NULL,
      port INT DEFAULT 25,
      enable_ssl TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT id FROM email_config LIMIT 1");
  if (!rows.length) {
    await runQuery(
      `INSERT INTO email_config (host, sender_name, sender_email, sender_password, port, enable_ssl)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["mail.maabaglamukhi.com", "Uttam Mohanty", "reports@maabaglamukhi.com", "Report@123#", 25, 0],
    );
  }
};

const mapRow = (r) => ({
  id: r.id,
  host: r.host || "",
  sender_name: r.sender_name || "",
  sender_email: r.sender_email || "",
  sender_password: r.sender_password || "",
  port: Number(r.port) || 25,
  enable_ssl: Number(r.enable_ssl) === 1,
});

const get = async () => {
  const rows = await runQuery("SELECT * FROM email_config ORDER BY id ASC LIMIT 1");
  return rows[0] ? mapRow(rows[0]) : null;
};

const save = async (body) => {
  const existing = await get();
  const portNum = Number(body?.port);
  const payload = {
    host: String(body?.host || "").trim() || null,
    sender_name: String(body?.sender_name || "").trim() || null,
    sender_email: String(body?.sender_email || "").trim() || null,
    sender_password:
      body?.sender_password !== undefined
        ? String(body.sender_password)
        : existing?.sender_password ?? null,
    port: Number.isFinite(portNum) && portNum > 0 ? portNum : 25,
    enable_ssl: body?.enable_ssl === true || body?.enable_ssl === 1 ? 1 : 0,
  };

  if (existing) {
    await runQuery(
      `UPDATE email_config
          SET host = ?, sender_name = ?, sender_email = ?,
              sender_password = ?, port = ?, enable_ssl = ?
        WHERE id = ?`,
      [
        payload.host, payload.sender_name, payload.sender_email,
        payload.sender_password, payload.port, payload.enable_ssl,
        existing.id,
      ],
    );
  } else {
    await runQuery(
      `INSERT INTO email_config (host, sender_name, sender_email, sender_password, port, enable_ssl)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.host, payload.sender_name, payload.sender_email,
        payload.sender_password, payload.port, payload.enable_ssl,
      ],
    );
  }

  return get();
};

module.exports = { ensureSchema, get, save };
