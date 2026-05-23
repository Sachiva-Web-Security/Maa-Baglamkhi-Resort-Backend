const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const BOOL_COLS = [
  "inclusive_tax",
  "reverse_tax_calculation",
  "enable_discount",
  "print_user_name_in_invoice",
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
  "ask_mobile_before_billing",
  "open_subgroup_in_popup",
  "send_bill_via_sms",
  "disable_save",
  "ask_guest_for_nc",
  "display_items_in_local_language",
  "print_invoice_for_online_orders",
  "ask_order_number_for_online_orders",
  "print_token_copy_at_terminal_printer",
  "print_invoice_copy_at_terminal_printer",
  "ask_sales_person_on_each_item",
  "ask_sales_person_on_bill",
];

const DEFAULT_TRUE = new Set([
  "inclusive_tax",
  "reverse_tax_calculation",
  "enable_discount",
  "allow_refund",
  "allow_nc",
  "open_tender_with_save",
  "print_time_in_invoice",
  "enable_parcel",
  "enable_hold",
  "enable_recall",
  "enable_tender",
  "enable_reprint",
  "enable_barcode",
  "show_top_selling_items",
  "show_favourite_items",
  "print_invoice_no_in_invoice",
  "print_date_in_invoice",
  "customer_required_in_refund",
  "send_bill_via_sms",
  "disable_save",
  "ask_guest_for_nc",
  "print_invoice_for_online_orders",
]);

const ensureSchema = async () => {
  const colDefs = BOOL_COLS.map(
    (k) => `${k} TINYINT(1) NOT NULL DEFAULT ${DEFAULT_TRUE.has(k) ? 1 : 0}`,
  ).join(",\n      ");

  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_quick_sales_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ${colDefs},
      no_of_invoice_copy INT NOT NULL DEFAULT 1,
      invoice_heading VARCHAR(191) NOT NULL DEFAULT 'RETAIL INVOICE',
      default_payment_mode VARCHAR(64) NOT NULL DEFAULT 'CASH',
      token_no_initialize VARCHAR(16) NOT NULL DEFAULT 'Daily',
      invoice_no_initialize VARCHAR(16) NOT NULL DEFAULT 'Monthly',
      invoice_no_prefix VARCHAR(32) DEFAULT 'false',
      invoice_no_suffix VARCHAR(32) DEFAULT 'false',
      invoice_printer_location_id INT DEFAULT NULL,
      extra_copy_printer_location_id INT DEFAULT NULL,
      day_closing_hour INT NOT NULL DEFAULT 1,
      day_closing_minute INT NOT NULL DEFAULT 30,
      day_closing_meridiem VARCHAR(4) NOT NULL DEFAULT 'AM',
      invoice_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_printer_location_id) REFERENCES printer_locations(id) ON DELETE SET NULL,
      FOREIGN KEY (extra_copy_printer_location_id) REFERENCES printer_locations(id) ON DELETE SET NULL
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_quick_sales_settings");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const main = await runQuery(
      "SELECT id FROM printer_locations WHERE name = 'Main' LIMIT 1",
    );
    await runQuery(
      `INSERT INTO fb_quick_sales_settings (invoice_printer_location_id) VALUES (?)`,
      [main?.[0]?.id || null],
    );
  }
};

const mapRow = (r) => {
  const out = { id: r.id };
  for (const k of BOOL_COLS) out[k] = Number(r[k]) === 1;
  out.no_of_invoice_copy = Number(r.no_of_invoice_copy || 1);
  out.invoice_heading = r.invoice_heading || "RETAIL INVOICE";
  out.default_payment_mode = r.default_payment_mode || "CASH";
  out.token_no_initialize = r.token_no_initialize || "Daily";
  out.invoice_no_initialize = r.invoice_no_initialize || "Monthly";
  out.invoice_no_prefix = r.invoice_no_prefix || "";
  out.invoice_no_suffix = r.invoice_no_suffix || "";
  out.invoice_printer_location_id = r.invoice_printer_location_id;
  out.extra_copy_printer_location_id = r.extra_copy_printer_location_id;
  out.day_closing_hour = Number(r.day_closing_hour || 1);
  out.day_closing_minute = Number(r.day_closing_minute || 30);
  out.day_closing_meridiem = r.day_closing_meridiem || "AM";
  out.invoice_note = r.invoice_note || "";
  return out;
};

const get = async () => {
  const rows = await runQuery(
    "SELECT * FROM fb_quick_sales_settings ORDER BY id ASC LIMIT 1",
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const save = async (body) => {
  const existing = await runQuery(
    "SELECT id FROM fb_quick_sales_settings ORDER BY id ASC LIMIT 1",
  );

  const boolVals = BOOL_COLS.map((k) => (body?.[k] ? 1 : 0));
  const scalarVals = [
    Number(body?.no_of_invoice_copy) || 1,
    String(body?.invoice_heading || "RETAIL INVOICE"),
    String(body?.default_payment_mode || "CASH"),
    String(body?.token_no_initialize || "Daily"),
    String(body?.invoice_no_initialize || "Monthly"),
    String(body?.invoice_no_prefix || ""),
    String(body?.invoice_no_suffix || ""),
    body?.invoice_printer_location_id ? Number(body.invoice_printer_location_id) : null,
    body?.extra_copy_printer_location_id ? Number(body.extra_copy_printer_location_id) : null,
    Number(body?.day_closing_hour) || 1,
    Number(body?.day_closing_minute) || 30,
    String(body?.day_closing_meridiem || "AM"),
    String(body?.invoice_note ?? ""),
  ];

  const setClause = [
    ...BOOL_COLS.map((k) => `${k} = ?`),
    "no_of_invoice_copy = ?",
    "invoice_heading = ?",
    "default_payment_mode = ?",
    "token_no_initialize = ?",
    "invoice_no_initialize = ?",
    "invoice_no_prefix = ?",
    "invoice_no_suffix = ?",
    "invoice_printer_location_id = ?",
    "extra_copy_printer_location_id = ?",
    "day_closing_hour = ?",
    "day_closing_minute = ?",
    "day_closing_meridiem = ?",
    "invoice_note = ?",
  ].join(", ");

  const allParams = [...boolVals, ...scalarVals];

  if (existing[0]) {
    await runQuery(
      `UPDATE fb_quick_sales_settings SET ${setClause} WHERE id = ?`,
      [...allParams, existing[0].id],
    );
  } else {
    const insertCols = [
      ...BOOL_COLS,
      "no_of_invoice_copy",
      "invoice_heading",
      "default_payment_mode",
      "token_no_initialize",
      "invoice_no_initialize",
      "invoice_no_prefix",
      "invoice_no_suffix",
      "invoice_printer_location_id",
      "extra_copy_printer_location_id",
      "day_closing_hour",
      "day_closing_minute",
      "day_closing_meridiem",
      "invoice_note",
    ];
    const placeholders = insertCols.map(() => "?").join(", ");
    await runQuery(
      `INSERT INTO fb_quick_sales_settings (${insertCols.join(", ")}) VALUES (${placeholders})`,
      allParams,
    );
  }
  return get();
};

module.exports = { ensureSchema, get, save, BOOL_COLS };
