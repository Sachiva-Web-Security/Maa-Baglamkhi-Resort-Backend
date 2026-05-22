const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const BOOL_COLS = [
  "inclusive_tax",
  "enable_discount",
  "print_user_name",
  "price_override_allowed",
  "apply_service_charge_in_parcel",
  "allow_refund",
  "allow_nc",
  "open_tender_with_save",
  "print_invoice",
  "print_token_no",
  "print_time_in_invoice",
  "enable_parcel",
  "enable_hold",
  "enable_recall",
  "enable_tender",
  "enable_reprint",
  "enable_barcode",
  "enable_open_drawer",
  "enable_sitting_location",
  "show_top_selling_items",
  "show_favourite_items",
  "print_invoice_no_in_invoice",
  "print_date_in_invoice",
  "split_invoice_as_per_group",
  "customer_required_in_refund",
  "bill_post_to_room_directly",
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_room_service_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      inclusive_tax TINYINT(1) NOT NULL DEFAULT 0,
      enable_discount TINYINT(1) NOT NULL DEFAULT 1,
      print_user_name TINYINT(1) NOT NULL DEFAULT 0,
      price_override_allowed TINYINT(1) NOT NULL DEFAULT 1,
      apply_service_charge_in_parcel TINYINT(1) NOT NULL DEFAULT 1,
      allow_refund TINYINT(1) NOT NULL DEFAULT 1,
      allow_nc TINYINT(1) NOT NULL DEFAULT 1,
      open_tender_with_save TINYINT(1) NOT NULL DEFAULT 0,
      print_invoice TINYINT(1) NOT NULL DEFAULT 1,
      print_token_no TINYINT(1) NOT NULL DEFAULT 1,
      print_time_in_invoice TINYINT(1) NOT NULL DEFAULT 1,
      enable_parcel TINYINT(1) NOT NULL DEFAULT 1,
      enable_hold TINYINT(1) NOT NULL DEFAULT 1,
      enable_recall TINYINT(1) NOT NULL DEFAULT 1,
      enable_tender TINYINT(1) NOT NULL DEFAULT 1,
      enable_reprint TINYINT(1) NOT NULL DEFAULT 1,
      enable_barcode TINYINT(1) NOT NULL DEFAULT 1,
      enable_open_drawer TINYINT(1) NOT NULL DEFAULT 1,
      enable_sitting_location TINYINT(1) NOT NULL DEFAULT 1,
      show_top_selling_items TINYINT(1) NOT NULL DEFAULT 1,
      show_favourite_items TINYINT(1) NOT NULL DEFAULT 1,
      print_invoice_no_in_invoice TINYINT(1) NOT NULL DEFAULT 1,
      print_date_in_invoice TINYINT(1) NOT NULL DEFAULT 1,
      split_invoice_as_per_group TINYINT(1) NOT NULL DEFAULT 1,
      customer_required_in_refund TINYINT(1) NOT NULL DEFAULT 0,
      bill_post_to_room_directly TINYINT(1) NOT NULL DEFAULT 0,
      no_of_invoice_copy INT NOT NULL DEFAULT 1,
      invoice_heading VARCHAR(191) NOT NULL DEFAULT 'RETAIL INVOICE',
      default_payment_mode VARCHAR(64) NOT NULL DEFAULT 'CASH',
      token_no_initialize VARCHAR(16) NOT NULL DEFAULT 'None',
      invoice_no_initialize VARCHAR(16) NOT NULL DEFAULT 'None',
      invoice_no_prefix VARCHAR(32) DEFAULT 'false',
      invoice_no_suffix VARCHAR(32) DEFAULT 'false',
      invoice_printer_location_id INT DEFAULT NULL,
      day_closing_hour INT NOT NULL DEFAULT 1,
      day_closing_minute INT NOT NULL DEFAULT 30,
      day_closing_meridiem VARCHAR(4) NOT NULL DEFAULT 'AM',
      invoice_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_printer_location_id) REFERENCES printer_locations(id) ON DELETE SET NULL
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_room_service_settings");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const kitchen = await runQuery(
      "SELECT id FROM printer_locations WHERE name = 'Kitchen' LIMIT 1",
    );
    await runQuery(
      `INSERT INTO fb_room_service_settings
         (invoice_printer_location_id, invoice_note)
       VALUES (?, ?)`,
      [kitchen?.[0]?.id || null, "This is for testing Room Service Invoice Note"],
    );
  }
};

const mapRow = (r) => {
  const out = { id: r.id };
  for (const k of BOOL_COLS) out[k] = Number(r[k]) === 1;
  out.no_of_invoice_copy = Number(r.no_of_invoice_copy || 1);
  out.invoice_heading = r.invoice_heading || "";
  out.default_payment_mode = r.default_payment_mode || "CASH";
  out.token_no_initialize = r.token_no_initialize || "None";
  out.invoice_no_initialize = r.invoice_no_initialize || "None";
  out.invoice_no_prefix = r.invoice_no_prefix || "";
  out.invoice_no_suffix = r.invoice_no_suffix || "";
  out.invoice_printer_location_id = r.invoice_printer_location_id;
  out.invoice_printer_location_name = r.invoice_printer_location_name || "";
  out.day_closing_hour = Number(r.day_closing_hour || 1);
  out.day_closing_minute = Number(r.day_closing_minute || 30);
  out.day_closing_meridiem = r.day_closing_meridiem || "AM";
  out.invoice_note = r.invoice_note || "";
  return out;
};

const get = async () => {
  const rows = await runQuery(`
    SELECT s.*, pl.name AS invoice_printer_location_name
      FROM fb_room_service_settings s
      LEFT JOIN printer_locations pl ON pl.id = s.invoice_printer_location_id
      ORDER BY s.id ASC LIMIT 1
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const save = async (body) => {
  const exists = await runQuery("SELECT id FROM fb_room_service_settings ORDER BY id ASC LIMIT 1");
  const id = exists?.[0]?.id;

  const bools = {};
  for (const k of BOOL_COLS) bools[k] = body?.[k] ? 1 : 0;

  const payload = [
    ...BOOL_COLS.map((k) => bools[k]),
    Number(body?.no_of_invoice_copy) || 1,
    String(body?.invoice_heading || "RETAIL INVOICE"),
    String(body?.default_payment_mode || "CASH"),
    String(body?.token_no_initialize || "None"),
    String(body?.invoice_no_initialize || "None"),
    String(body?.invoice_no_prefix ?? ""),
    String(body?.invoice_no_suffix ?? ""),
    body?.invoice_printer_location_id ? Number(body.invoice_printer_location_id) : null,
    Number(body?.day_closing_hour) || 1,
    Number(body?.day_closing_minute) || 30,
    String(body?.day_closing_meridiem || "AM"),
    String(body?.invoice_note || ""),
  ];

  const setBool = BOOL_COLS.map((c) => `${c} = ?`).join(", ");

  if (id) {
    await runQuery(
      `UPDATE fb_room_service_settings SET
         ${setBool},
         no_of_invoice_copy = ?, invoice_heading = ?, default_payment_mode = ?,
         token_no_initialize = ?, invoice_no_initialize = ?,
         invoice_no_prefix = ?, invoice_no_suffix = ?,
         invoice_printer_location_id = ?, day_closing_hour = ?,
         day_closing_minute = ?, day_closing_meridiem = ?, invoice_note = ?
       WHERE id = ?`,
      [...payload, id],
    );
  } else {
    const colList = BOOL_COLS.join(", ") +
      ", no_of_invoice_copy, invoice_heading, default_payment_mode," +
      " token_no_initialize, invoice_no_initialize, invoice_no_prefix, invoice_no_suffix," +
      " invoice_printer_location_id, day_closing_hour, day_closing_minute, day_closing_meridiem, invoice_note";
    const placeholders = payload.map(() => "?").join(", ");
    await runQuery(
      `INSERT INTO fb_room_service_settings (${colList}) VALUES (${placeholders})`,
      payload,
    );
  }
  return get();
};

module.exports = { ensureSchema, get, save };
