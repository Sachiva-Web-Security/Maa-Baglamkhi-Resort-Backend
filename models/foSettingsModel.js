const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ROOM_STATUSES = ["Available", "Cleaning", "Maintenance", "Blocked"];
const INVOICE_INITS = ["Daily", "Monthly", "Yearly", "None"];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fo_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      checkout_mode VARCHAR(20) NOT NULL DEFAULT '24hours',
      checkout_specific_time VARCHAR(10) DEFAULT NULL,
      grace_period_hours INT NOT NULL DEFAULT 1,
      invoice_no_init VARCHAR(20) NOT NULL DEFAULT 'Yearly',
      room_status_after_checkout VARCHAR(50) NOT NULL DEFAULT 'Available',
      send_checkin_sms_guest TINYINT(1) NOT NULL DEFAULT 0,
      send_checkin_sms_owner TINYINT(1) NOT NULL DEFAULT 1,
      send_checkout_sms_guest TINYINT(1) NOT NULL DEFAULT 0,
      send_checkout_sms_owner TINYINT(1) NOT NULL DEFAULT 1,
      send_night_audit_report_owner TINYINT(1) NOT NULL DEFAULT 1,
      owner_mobile_numbers VARCHAR(500) DEFAULT NULL,
      owner_email_ids VARCHAR(500) DEFAULT NULL,
      invoice_note TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT id FROM fo_settings LIMIT 1");
  if (!rows.length) {
    await runQuery(
      `INSERT INTO fo_settings
         (checkout_mode, grace_period_hours, invoice_no_init,
          room_status_after_checkout,
          send_checkin_sms_guest, send_checkin_sms_owner,
          send_checkout_sms_guest, send_checkout_sms_owner,
          send_night_audit_report_owner,
          owner_mobile_numbers, owner_email_ids, invoice_note)
       VALUES (?, ?, ?, ?, 0, 1, 0, 1, 1, ?, ?, ?)`,
      [
        "24hours",
        1,
        "Yearly",
        "Available",
        "9425921501,9424582382",
        "MAABAGLAMUKHIRESORT@GMAIL.COM",
        "Checkout Time: 10 PM<br>Please deposit key at counter at checkout.",
      ],
    );
  }
};

const mapRow = (r) => ({
  id: r.id,
  checkout_mode: r.checkout_mode || "24hours",
  checkout_specific_time: r.checkout_specific_time || "",
  grace_period_hours: Number(r.grace_period_hours) || 1,
  invoice_no_init: r.invoice_no_init || "Yearly",
  room_status_after_checkout: r.room_status_after_checkout || "Available",
  send_checkin_sms_guest: Number(r.send_checkin_sms_guest) === 1,
  send_checkin_sms_owner: Number(r.send_checkin_sms_owner) === 1,
  send_checkout_sms_guest: Number(r.send_checkout_sms_guest) === 1,
  send_checkout_sms_owner: Number(r.send_checkout_sms_owner) === 1,
  send_night_audit_report_owner: Number(r.send_night_audit_report_owner) === 1,
  owner_mobile_numbers: r.owner_mobile_numbers || "",
  owner_email_ids: r.owner_email_ids || "",
  invoice_note: r.invoice_note || "",
});

const get = async () => {
  const rows = await runQuery("SELECT * FROM fo_settings ORDER BY id ASC LIMIT 1");
  return rows[0] ? mapRow(rows[0]) : null;
};

const boolish = (v) => (v === true || v === 1 || v === "1" || v === "true" ? 1 : 0);

const sanitize = (body) => {
  const checkout_mode =
    body?.checkout_mode === "specific_time" ? "specific_time" : "24hours";
  const grace = Number(body?.grace_period_hours);
  const invoice_no_init = INVOICE_INITS.includes(body?.invoice_no_init)
    ? body.invoice_no_init
    : "Yearly";
  const room_status = ROOM_STATUSES.includes(body?.room_status_after_checkout)
    ? body.room_status_after_checkout
    : "Available";
  return {
    checkout_mode,
    checkout_specific_time:
      checkout_mode === "specific_time"
        ? String(body?.checkout_specific_time || "").trim() || null
        : null,
    grace_period_hours: Number.isFinite(grace) && grace >= 0 ? grace : 1,
    invoice_no_init,
    room_status_after_checkout: room_status,
    send_checkin_sms_guest: boolish(body?.send_checkin_sms_guest),
    send_checkin_sms_owner: boolish(body?.send_checkin_sms_owner),
    send_checkout_sms_guest: boolish(body?.send_checkout_sms_guest),
    send_checkout_sms_owner: boolish(body?.send_checkout_sms_owner),
    send_night_audit_report_owner: boolish(body?.send_night_audit_report_owner),
    owner_mobile_numbers: String(body?.owner_mobile_numbers || "").trim() || null,
    owner_email_ids: String(body?.owner_email_ids || "").trim() || null,
    invoice_note: body?.invoice_note != null ? String(body.invoice_note) : "",
  };
};

const save = async (body) => {
  const p = sanitize(body);
  const existing = await get();
  if (existing) {
    await runQuery(
      `UPDATE fo_settings SET
         checkout_mode = ?, checkout_specific_time = ?, grace_period_hours = ?,
         invoice_no_init = ?, room_status_after_checkout = ?,
         send_checkin_sms_guest = ?, send_checkin_sms_owner = ?,
         send_checkout_sms_guest = ?, send_checkout_sms_owner = ?,
         send_night_audit_report_owner = ?,
         owner_mobile_numbers = ?, owner_email_ids = ?, invoice_note = ?
       WHERE id = ?`,
      [
        p.checkout_mode, p.checkout_specific_time, p.grace_period_hours,
        p.invoice_no_init, p.room_status_after_checkout,
        p.send_checkin_sms_guest, p.send_checkin_sms_owner,
        p.send_checkout_sms_guest, p.send_checkout_sms_owner,
        p.send_night_audit_report_owner,
        p.owner_mobile_numbers, p.owner_email_ids, p.invoice_note,
        existing.id,
      ],
    );
  } else {
    await runQuery(
      `INSERT INTO fo_settings
         (checkout_mode, checkout_specific_time, grace_period_hours,
          invoice_no_init, room_status_after_checkout,
          send_checkin_sms_guest, send_checkin_sms_owner,
          send_checkout_sms_guest, send_checkout_sms_owner,
          send_night_audit_report_owner,
          owner_mobile_numbers, owner_email_ids, invoice_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.checkout_mode, p.checkout_specific_time, p.grace_period_hours,
        p.invoice_no_init, p.room_status_after_checkout,
        p.send_checkin_sms_guest, p.send_checkin_sms_owner,
        p.send_checkout_sms_guest, p.send_checkout_sms_owner,
        p.send_night_audit_report_owner,
        p.owner_mobile_numbers, p.owner_email_ids, p.invoice_note,
      ],
    );
  }
  return get();
};

module.exports = { ensureSchema, get, save };
