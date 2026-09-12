const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULT_SETTINGS = {
  adminWhatsappNumber: "",
  adminWhatsappUsername: "ankit",
  smsEnabled: false,
  businessName: "Maa Baglamukhi Resort",
  businessContact: "",
};

const ensureSettingsRow = async () => {
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
  const [existing] = await runQuery("SELECT id FROM app_settings WHERE id = 1");
  if (!existing) {
    await runQuery("INSERT INTO app_settings (id) VALUES (1)");
  }
};

const getSettings = async () => {
  await ensureSettingsRow();
  const [rows] = await runQuery("SELECT * FROM app_settings WHERE id = 1 LIMIT 1");
  const row = rows[0] || {};
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

const updateSettings = async (patch = {}) => {
  await ensureSettingsRow();

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

exports.getSettings = async (_req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    console.error("getSettings error:", err);
    res.status(500).json({ error: err.message || "Failed to load settings" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const allowed = [
      "adminWhatsappNumber",
      "adminWhatsappUsername",
      "smsEnabled",
      "businessName",
      "businessContact",
    ];
    const patch = {};
    for (const key of allowed) {
      if (key in (req.body || {})) {
        patch[key] = req.body[key];
      }
    }

    if (patch.adminWhatsappNumber) {
      const digits = String(patch.adminWhatsappNumber).replace(/\D+/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return res.status(400).json({
          error:
            "adminWhatsappNumber must be a valid phone number (10–15 digits, with country code)",
        });
      }
      patch.adminWhatsappNumber = digits;
    }

    const settings = await updateSettings(patch);
    res.json({ message: "Settings updated", settings });
  } catch (err) {
    console.error("updateSettings error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to update settings" });
  }
};