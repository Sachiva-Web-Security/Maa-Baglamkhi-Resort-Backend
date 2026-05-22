const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS hotel_info (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hotel_name VARCHAR(255) DEFAULT NULL,
      address_line1 VARCHAR(255) DEFAULT NULL,
      address_line2 VARCHAR(255) DEFAULT NULL,
      district VARCHAR(255) DEFAULT NULL,
      pincode VARCHAR(20) DEFAULT NULL,
      landline1 VARCHAR(50) DEFAULT NULL,
      landline2 VARCHAR(50) DEFAULT NULL,
      mobile1 VARCHAR(50) DEFAULT NULL,
      mobile2 VARCHAR(50) DEFAULT NULL,
      email VARCHAR(191) DEFAULT NULL,
      website VARCHAR(255) DEFAULT NULL,
      gst_number VARCHAR(50) DEFAULT NULL,
      pan_card VARCHAR(50) DEFAULT NULL,
      cheque_payable_to VARCHAR(255) DEFAULT NULL,
      invoice_note TEXT,
      logo_url VARCHAR(500) DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT id FROM hotel_info LIMIT 1");
  if (!rows.length) {
    await runQuery(
      `INSERT INTO hotel_info (hotel_name, address_line1, address_line2, district, pincode, mobile1, mobile2, email, website, invoice_note)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        "MAA BAGLAMUKHI RESORT",
        "Maa Baglamukhi Mandir Raod,",
        "Nalkhada",
        "Dist.Agar Malwa",
        "465445",
        "94259-21501",
        "94245-82382",
        "MAABAGLAMUKHIRESORT@GMAIL.COM",
        "WWW.MAABAGLAMUKHIRESORT.COM",
        "Thanks! Pl Visit Again!!!",
      ],
    );
  }
};

const getHotelInfo = async () => {
  const rows = await runQuery("SELECT * FROM hotel_info ORDER BY id ASC LIMIT 1");
  return rows[0] || null;
};

const FIELDS = [
  "hotel_name",
  "address_line1",
  "address_line2",
  "district",
  "pincode",
  "landline1",
  "landline2",
  "mobile1",
  "mobile2",
  "email",
  "website",
  "gst_number",
  "pan_card",
  "cheque_payable_to",
  "invoice_note",
  "logo_url",
];

const saveHotelInfo = async (payload) => {
  const existing = await getHotelInfo();

  const values = FIELDS.map((field) =>
    payload[field] === undefined ? existing?.[field] ?? null : payload[field],
  );

  if (existing) {
    const setClause = FIELDS.map((f) => `${f} = ?`).join(", ");
    await runQuery(
      `UPDATE hotel_info SET ${setClause} WHERE id = ?`,
      [...values, existing.id],
    );
    return getHotelInfo();
  }

  const cols = FIELDS.join(", ");
  const placeholders = FIELDS.map(() => "?").join(", ");
  await runQuery(`INSERT INTO hotel_info (${cols}) VALUES (${placeholders})`, values);
  return getHotelInfo();
};

module.exports = {
  ensureSchema,
  getHotelInfo,
  saveHotelInfo,
};
