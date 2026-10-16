/**
 * SettingsModel — single-row key/value store for system settings.
 *
 * Stores admin WhatsApp number and any other runtime-tunable configuration
 * that the admin should be able to change from the UI without touching .env.
 *
 * Schema:
 *   id INT PK
 *   admin_whatsapp_number   VARCHAR(30)  — admin's WhatsApp number (with country code)
 *   admin_whatsapp_username VARCHAR(80)  — Sachiva account username
 *   sms_enabled             TINYINT(1)   — whether to also send SMS text fallback
 *   business_name           VARCHAR(120) — resort name shown in WhatsApp messages
 *   business_contact        VARCHAR(120) — contact info shown in messages
 *   updated_at              TIMESTAMP
 */

const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULT_ROW = {
  id: 1,
  admin_whatsapp_number: "",
  admin_whatsapp_username: "",
  sms_enabled: 0,
  business_name: "Maa Baglamukhi Resort",
  business_contact: "+91-XXXXXXXXXX",
};

const columnExists = async (tableName, columnName) => {
  const rows = await runQuery(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [
    columnName,
  ]);
  return Array.isArray(rows) && rows.length > 0;
};

const ensureColumn = async (tableName, columnName, definition) => {
  if (!(await columnExists(tableName, columnName))) {
    await runQuery(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INT NOT NULL PRIMARY KEY,
      admin_whatsapp_number VARCHAR(30) DEFAULT NULL,
      admin_whatsapp_username VARCHAR(80) DEFAULT NULL,
      sms_enabled TINYINT(1) NOT NULL DEFAULT 0,
      business_name VARCHAR(120) DEFAULT 'Maa Baglamukhi Resort',
      business_contact VARCHAR(120) DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn(
    "app_settings",
    "admin_whatsapp_number",
    "VARCHAR(30) DEFAULT NULL",
  );
  await ensureColumn(
    "app_settings",
    "admin_whatsapp_username",
    "VARCHAR(80) DEFAULT NULL",
  );
  await ensureColumn(
    "app_settings",
    "sms_enabled",
    "TINYINT(1) NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    "app_settings",
    "business_name",
    "VARCHAR(120) DEFAULT 'Maa Baglamukhi Resort'",
  );
  await ensureColumn(
    "app_settings",
    "business_contact",
    "VARCHAR(120) DEFAULT NULL",
  );
  await ensureColumn(
    "app_settings",
    "updated_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );

  // Ensure single row id=1
  const [existing] = await runQuery("SELECT id FROM app_settings WHERE id = 1");
  if (!existing) {
    await runQuery("INSERT INTO app_settings (id) VALUES (1)");
  }
};

/**
 * Return the settings row joined with environment fallback values.
 * Never returns null — always returns an object with at least defaults.
 */
const getSettings = async () => {
  await ensureSchema();
  const rows = await runQuery("SELECT * FROM app_settings WHERE id = 1 LIMIT 1");
  const row = rows[0] || DEFAULT_ROW;
  return {
    id: row.id,
    adminWhatsappNumber:
      row.admin_whatsapp_number ||
      process.env.ADMIN_WHATSAPP_NUMBER ||
      "",
    adminWhatsappUsername:
      row.admin_whatsapp_username ||
      process.env.WASACHIVA_USERNAME ||
      "ankit",
    smsEnabled: Number(row.sms_enabled) === 1,
    businessName:
      row.business_name ||
      process.env.BUSINESS_NAME ||
      "Maa Baglamukhi Resort",
    businessContact:
      row.business_contact ||
      process.env.BUSINESS_CONTACT ||
      "",
    updatedAt: row.updated_at || null,
  };
};

/**
 * Update settings. Only fields present in the patch object are updated.
 * Returns the refreshed settings.
 */
const updateSettings = async (patch = {}) => {
  await ensureSchema();

  const map = {
    adminWhatsappNumber: "admin_whatsapp_number",
    adminWhatsappUsername: "admin_whatsapp_username",
    smsEnabled: "sms_enabled",
    businessName: "business_name",
    businessContact: "business_contact",
  };

  const setParts = [];
  const values = [];
  for (const [jsKey, dbCol] of Object.entries(map)) {
    if (!(jsKey in patch)) continue;
    let value = patch[jsKey];
    if (jsKey === "smsEnabled") {
      value = value ? 1 : 0;
    }
    if (value === "" || value === null || value === undefined) {
      value = null;
    }
    setParts.push(`${dbCol} = ?`);
    values.push(value);
  }

  if (setParts.length) {
    await runQuery(
      `UPDATE app_settings SET ${setParts.join(", ")} WHERE id = 1`,
      values,
    );
  }

  return getSettings();
};

module.exports = {
  ensureSchema,
  getSettings,
  updateSettings,
};