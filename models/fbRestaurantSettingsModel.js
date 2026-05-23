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
  "service_charges_in_parcel",
  "allow_refund",
  "allow_nc",
  "open_tender_with_save",
  "skip_captain_selection",
  "direct_bill_settlement_in_cash",
  "alternate_bar_kot_print",
  "print_only_token_in_counter_sale",
  "print_token_copy_at_terminal_printer",
  "print_invoice_copy_at_terminal_printer",
  "show_item_group_by_price_list",
  "send_void_sms_to_owner",
  "send_nc_sms_to_owner",
  "send_discount_sms_to_owner",
  "send_bill_edit_sms_to_owner",
  "send_bill_settlement_sms_to_owner",
  "send_refund_sms_to_owner",
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_restaurant_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      inclusive_tax TINYINT(1) NOT NULL DEFAULT 0,
      reverse_tax_calculation TINYINT(1) NOT NULL DEFAULT 0,
      enable_discount TINYINT(1) NOT NULL DEFAULT 1,
      default_payment_mode VARCHAR(64) NOT NULL DEFAULT 'CASH',
      token_no_initialize VARCHAR(16) NOT NULL DEFAULT 'Daily',
      invoice_no_initialize VARCHAR(16) NOT NULL DEFAULT 'Yearly',
      print_user_name_in_invoice TINYINT(1) NOT NULL DEFAULT 0,
      no_of_invoice_copy INT NOT NULL DEFAULT 1,
      invoice_heading VARCHAR(191) NOT NULL DEFAULT 'RETAIL INVOICE',
      price_override_allowed TINYINT(1) NOT NULL DEFAULT 1,
      service_charges_in_parcel TINYINT(1) NOT NULL DEFAULT 0,
      allow_refund TINYINT(1) NOT NULL DEFAULT 0,
      allow_nc TINYINT(1) NOT NULL DEFAULT 0,
      open_tender_with_save TINYINT(1) NOT NULL DEFAULT 0,
      skip_captain_selection TINYINT(1) NOT NULL DEFAULT 0,
      direct_bill_settlement_in_cash TINYINT(1) NOT NULL DEFAULT 0,
      alternate_bar_kot_print TINYINT(1) NOT NULL DEFAULT 0,
      print_only_token_in_counter_sale TINYINT(1) NOT NULL DEFAULT 0,
      print_token_copy_at_terminal_printer TINYINT(1) NOT NULL DEFAULT 1,
      print_invoice_copy_at_terminal_printer TINYINT(1) NOT NULL DEFAULT 0,
      show_item_group_by_price_list TINYINT(1) NOT NULL DEFAULT 1,
      send_void_sms_to_owner TINYINT(1) NOT NULL DEFAULT 1,
      send_nc_sms_to_owner TINYINT(1) NOT NULL DEFAULT 1,
      send_discount_sms_to_owner TINYINT(1) NOT NULL DEFAULT 1,
      send_bill_edit_sms_to_owner TINYINT(1) NOT NULL DEFAULT 1,
      send_bill_settlement_sms_to_owner TINYINT(1) NOT NULL DEFAULT 1,
      send_refund_sms_to_owner TINYINT(1) NOT NULL DEFAULT 1,
      owner_mobile_numbers VARCHAR(255) DEFAULT NULL,
      owner_email VARCHAR(191) DEFAULT NULL,
      invoice_printer_location_id INT DEFAULT NULL,
      invoice_round_off INT NOT NULL DEFAULT 1,
      day_closing_hour INT NOT NULL DEFAULT 1,
      day_closing_minute INT NOT NULL DEFAULT 30,
      day_closing_meridiem VARCHAR(4) NOT NULL DEFAULT 'AM',
      invoice_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_printer_location_id) REFERENCES printer_locations(id) ON DELETE SET NULL
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_restaurant_settings");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const main = await runQuery(
      "SELECT id FROM printer_locations WHERE name = 'Main' LIMIT 1",
    );
    await runQuery(
      `INSERT INTO fb_restaurant_settings
         (owner_mobile_numbers, owner_email, invoice_printer_location_id, invoice_note)
       VALUES (?, ?, ?, ?)`,
      [
        "9425921501,9424582382",
        "maabaglamukhiresort@gmail.com",
        main?.[0]?.id || null,
        "FSSAI NO. 11420995000031\nThanks Please Visit Again!!!",
      ],
    );
  }
};

const mapRow = (r) => {
  const out = { id: r.id };
  for (const k of BOOL_COLS) out[k] = Number(r[k]) === 1;
  out.default_payment_mode = r.default_payment_mode || "CASH";
  out.token_no_initialize = r.token_no_initialize || "Daily";
  out.invoice_no_initialize = r.invoice_no_initialize || "Yearly";
  out.no_of_invoice_copy = Number(r.no_of_invoice_copy || 1);
  out.invoice_heading = r.invoice_heading || "RETAIL INVOICE";
  out.owner_mobile_numbers = r.owner_mobile_numbers || "";
  out.owner_email = r.owner_email || "";
  out.invoice_printer_location_id = r.invoice_printer_location_id;
  out.invoice_round_off = Number(r.invoice_round_off || 1);
  out.day_closing_hour = Number(r.day_closing_hour || 1);
  out.day_closing_minute = Number(r.day_closing_minute || 30);
  out.day_closing_meridiem = r.day_closing_meridiem || "AM";
  out.invoice_note = r.invoice_note || "";
  return out;
};

const get = async () => {
  const rows = await runQuery(
    "SELECT * FROM fb_restaurant_settings ORDER BY id ASC LIMIT 1",
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const save = async (body) => {
  const existing = await runQuery(
    "SELECT id FROM fb_restaurant_settings ORDER BY id ASC LIMIT 1",
  );
  const boolVals = BOOL_COLS.map((k) => (body?.[k] ? 1 : 0));
  const scalarVals = [
    String(body?.default_payment_mode || "CASH"),
    String(body?.token_no_initialize || "Daily"),
    String(body?.invoice_no_initialize || "Yearly"),
    Number(body?.no_of_invoice_copy) || 1,
    String(body?.invoice_heading || "RETAIL INVOICE"),
    String(body?.owner_mobile_numbers || "").trim() || null,
    String(body?.owner_email || "").trim() || null,
    body?.invoice_printer_location_id ? Number(body.invoice_printer_location_id) : null,
    Number(body?.invoice_round_off) || 1,
    Number(body?.day_closing_hour) || 1,
    Number(body?.day_closing_minute) || 30,
    String(body?.day_closing_meridiem || "AM"),
    String(body?.invoice_note ?? ""),
  ];

  // BOOL_COLS layout in column order matches the CREATE TABLE statement;
  // we re-list them explicitly in the UPDATE so naming stays clear.
  const setClause = [
    ...BOOL_COLS.map((k) => `${k} = ?`),
    "default_payment_mode = ?",
    "token_no_initialize = ?",
    "invoice_no_initialize = ?",
    "no_of_invoice_copy = ?",
    "invoice_heading = ?",
    "owner_mobile_numbers = ?",
    "owner_email = ?",
    "invoice_printer_location_id = ?",
    "invoice_round_off = ?",
    "day_closing_hour = ?",
    "day_closing_minute = ?",
    "day_closing_meridiem = ?",
    "invoice_note = ?",
  ].join(", ");

  const allParams = [...boolVals, ...scalarVals];

  if (existing[0]) {
    await runQuery(
      `UPDATE fb_restaurant_settings SET ${setClause} WHERE id = ?`,
      [...allParams, existing[0].id],
    );
  } else {
    const insertCols = [
      ...BOOL_COLS,
      "default_payment_mode",
      "token_no_initialize",
      "invoice_no_initialize",
      "no_of_invoice_copy",
      "invoice_heading",
      "owner_mobile_numbers",
      "owner_email",
      "invoice_printer_location_id",
      "invoice_round_off",
      "day_closing_hour",
      "day_closing_minute",
      "day_closing_meridiem",
      "invoice_note",
    ];
    const placeholders = insertCols.map(() => "?").join(", ");
    await runQuery(
      `INSERT INTO fb_restaurant_settings (${insertCols.join(", ")}) VALUES (${placeholders})`,
      allParams,
    );
  }
  return get();
};

module.exports = { ensureSchema, get, save };
