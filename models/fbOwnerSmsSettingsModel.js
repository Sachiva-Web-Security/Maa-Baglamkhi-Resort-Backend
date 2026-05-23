const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureColumn = async (tableName, columnName, definition) => {
  const rows = await runQuery(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (!rows.length) {
    await runQuery(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const DEFAULT_TEMPLATES = [
  {
    code: "booking_confirmation",
    label: "Booking Confirmation",
    body: "Hi {guest_name}, your booking at Maa Baglamukhi Resort is confirmed. Room: {room_no}, Check-in: {checkin_date}. Thank you!",
    is_active: 1,
  },
  {
    code: "invoice",
    label: "Invoice",
    body: "Hello {guest_name}, your invoice {invoice_no} for amount ₹{amount} is attached. Thanks for staying with us.",
    is_active: 1,
  },
  {
    code: "payment_reminder",
    label: "Payment Reminder",
    body: "Hi {guest_name}, this is a friendly reminder for the pending balance of ₹{amount} on invoice {invoice_no}.",
    is_active: 1,
  },
  {
    code: "checkout_thanks",
    label: "Checkout Thank You",
    body: "Thank you {guest_name} for staying with Maa Baglamukhi Resort. We hope to see you again soon!",
    is_active: 1,
  },
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_owner_sms_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      wasend_username VARCHAR(191) DEFAULT NULL,
      wasend_token VARCHAR(255) DEFAULT NULL,
      sender_number VARCHAR(32) DEFAULT NULL,
      public_base_url VARCHAR(255) DEFAULT NULL,
      auto_send_invoice TINYINT(1) NOT NULL DEFAULT 1,
      auto_send_restaurant_bill TINYINT(1) NOT NULL DEFAULT 0,
      auto_send_booking_confirmation TINYINT(1) NOT NULL DEFAULT 1,
      auto_send_payment_reminder TINYINT(1) NOT NULL DEFAULT 0,
      auto_send_checkout_thanks TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_owner_sms_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      label VARCHAR(191) NOT NULL,
      body TEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const settingsRows = await runQuery("SELECT COUNT(*) AS count FROM fb_owner_sms_settings");
  if (Number(settingsRows?.[0]?.count || 0) === 0) {
    await runQuery(
      `INSERT INTO fb_owner_sms_settings
         (wasend_username, wasend_token, sender_number, public_base_url, auto_send_restaurant_bill)
       VALUES (?, ?, ?, ?, ?)`,
      [
        process.env.WASEND_USERNAME || "anju",
        process.env.WASEND_TOKEN || "",
        "+917247242931",
        process.env.PUBLIC_BASE_URL || "",
        0,
      ],
    );
  }

  await ensureColumn(
    "fb_owner_sms_settings",
    "auto_send_restaurant_bill",
    "TINYINT(1) NOT NULL DEFAULT 0 AFTER auto_send_invoice",
  );
  await ensureColumn(
    "fb_owner_sms_settings",
    "public_base_url",
    "VARCHAR(255) DEFAULT NULL AFTER sender_number",
  );

  const tplRows = await runQuery("SELECT COUNT(*) AS count FROM fb_owner_sms_templates");
  if (Number(tplRows?.[0]?.count || 0) === 0) {
    for (const t of DEFAULT_TEMPLATES) {
      await runQuery(
        "INSERT INTO fb_owner_sms_templates (code, label, body, is_active) VALUES (?, ?, ?, ?)",
        [t.code, t.label, t.body, t.is_active],
      );
    }
  }
};

const mapSettings = (r) => ({
  id: r.id,
  wasend_username: r.wasend_username || "",
  wasend_token: r.wasend_token || "",
  sender_number: r.sender_number || "",
  public_base_url: r.public_base_url || "",
  auto_send_invoice: Number(r.auto_send_invoice) === 1,
  auto_send_restaurant_bill: Number(r.auto_send_restaurant_bill) === 1,
  auto_send_booking_confirmation: Number(r.auto_send_booking_confirmation) === 1,
  auto_send_payment_reminder: Number(r.auto_send_payment_reminder) === 1,
  auto_send_checkout_thanks: Number(r.auto_send_checkout_thanks) === 1,
});

const mapTemplate = (r) => ({
  id: r.id,
  code: r.code || "",
  label: r.label || "",
  body: r.body || "",
  is_active: Number(r.is_active) === 1,
});

const getSettings = async () => {
  await ensureSchema();
  const rows = await runQuery(
    "SELECT * FROM fb_owner_sms_settings ORDER BY id ASC LIMIT 1",
  );
  return rows[0] ? mapSettings(rows[0]) : null;
};

const saveSettings = async (body) => {
  await ensureSchema();
  const existing = await runQuery(
    "SELECT id FROM fb_owner_sms_settings ORDER BY id ASC LIMIT 1",
  );
  const params = [
    String(body?.wasend_username || "").trim() || null,
    String(body?.wasend_token || "").trim() || null,
    String(body?.sender_number || "").trim() || null,
    String(body?.public_base_url || "").trim() || null,
    body?.auto_send_invoice ? 1 : 0,
    body?.auto_send_restaurant_bill ? 1 : 0,
    body?.auto_send_booking_confirmation ? 1 : 0,
    body?.auto_send_payment_reminder ? 1 : 0,
    body?.auto_send_checkout_thanks ? 1 : 0,
  ];
  if (existing[0]) {
    await runQuery(
      `UPDATE fb_owner_sms_settings SET
         wasend_username = ?, wasend_token = ?, sender_number = ?, public_base_url = ?,
         auto_send_invoice = ?, auto_send_restaurant_bill = ?, auto_send_booking_confirmation = ?,
         auto_send_payment_reminder = ?, auto_send_checkout_thanks = ?
       WHERE id = ?`,
      [...params, existing[0].id],
    );
  } else {
    await runQuery(
      `INSERT INTO fb_owner_sms_settings
         (wasend_username, wasend_token, sender_number, public_base_url,
          auto_send_invoice, auto_send_restaurant_bill, auto_send_booking_confirmation,
          auto_send_payment_reminder, auto_send_checkout_thanks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params,
    );
  }
  return getSettings();
};

const listTemplates = async () => {
  const rows = await runQuery("SELECT * FROM fb_owner_sms_templates ORDER BY id ASC");
  return rows.map(mapTemplate);
};

const updateTemplate = async (id, body) => {
  const label = String(body?.label || "").trim();
  const tplBody = String(body?.body || "").trim();
  const is_active = body?.is_active === false || body?.is_active === 0 ? 0 : 1;
  if (!label) throw new Error("Template label is required");
  if (!tplBody) throw new Error("Template body is required");
  await runQuery(
    "UPDATE fb_owner_sms_templates SET label = ?, body = ?, is_active = ? WHERE id = ?",
    [label, tplBody, is_active, id],
  );
  const rows = await runQuery("SELECT * FROM fb_owner_sms_templates WHERE id = ?", [id]);
  return rows[0] ? mapTemplate(rows[0]) : null;
};

const safeFetch =
  global.fetch ||
  (async (...args) => {
    const undici = require("undici");
    return undici.fetch(...args);
  });

const sendTest = async ({ number, message, fileUrl, fileName }) => {
  const settings = await getSettings();
  const username = settings?.wasend_username || process.env.WASEND_USERNAME;
  const token = settings?.wasend_token || process.env.WASEND_TOKEN;
  if (!username || !token) throw new Error("WASend credentials not configured");
  if (!number) throw new Error("Recipient number is required");
  if (!message) throw new Error("Message body is required");

  const url = new URL("https://wasend.sachiva.cloud/api/send-message");
  url.searchParams.set("username", username);
  url.searchParams.set("token", token);
  url.searchParams.set("number", String(number).replace(/[^0-9]/g, ""));
  url.searchParams.set("message", message);
  if (fileUrl) url.searchParams.set("file_url", fileUrl);
  if (fileName) url.searchParams.set("file_name", fileName);

  const response = await safeFetch(url.toString());
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
};

const buildSampleInvoice = () => ({
  id: Date.now(),
  invoiceNo: `TEST-${Date.now()}`,
  date: new Date().toLocaleString("en-IN"),
  customerName: "Walk-in Guest",
  phone: "918818848558",
  roomNumber: "—",
  items: [
    { name: "Mineral Water 1 Ltr.", quantity: 1, price: 19.1, total: 19.1 },
    { name: "Green Salad", quantity: 1, price: 60.0, total: 60.0 },
    { name: "Dal Fry", quantity: 1, price: 140.0, total: 140.0 },
    { name: "Tandoori Roti Butter", quantity: 12, price: 19.0, total: 228.0 },
    { name: "Jeera Rice", quantity: 1, price: 140.0, total: 140.0 },
    { name: "half dal", quantity: 1, price: 80.0, total: 80.0 },
  ],
  subtotal: 667.1,
  tax: 33.36,
  discount: 0,
  totalAmount: 700.0,
});

const generateSamplePdf = async () => {
  const { generateInvoicePdf } = require("../utils/pdfGenerator");
  const sample = buildSampleInvoice();
  const { filePath, fileName } = await generateInvoicePdf(sample);
  return { filePath, fileName, sample };
};

const sendTestPdf = async ({ number, message, publicBaseUrl }) => {
  const normalizedBaseUrl = String(publicBaseUrl || "").trim().replace(/\/$/, "");
  if (!normalizedBaseUrl) {
    throw new Error(
      "PUBLIC_BASE_URL is required so WASend can reach the PDF. Set it in .env or pass it from the page.",
    );
  }
  const { fileName, sample } = await generateSamplePdf();
  const fileUrl = `${normalizedBaseUrl}/uploads/invoices/${fileName}`;
  const finalMessage =
    message ||
    `Your test invoice ${sample.invoiceNo} — Total ₹${sample.totalAmount.toFixed(2)}`;
  return sendTest({ number, message: finalMessage, fileUrl, fileName });
};

module.exports = {
  ensureSchema,
  getSettings,
  saveSettings,
  listTemplates,
  updateTemplate,
  generateSamplePdf,
  sendTestPdf,
  sendTest,
};
