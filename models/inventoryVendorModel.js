const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const SEEDS = [
  { name: "NAKODA SWEETS",        address: "NALKHADA",  city: "NALKHEDA", contact_person: "ABHINANDSAN", mobile_number: "9424804470", landline_number: "2" },
  { name: "GAS",                  address: "NALHEDA",   city: "NALKHEDA", contact_person: "1",           mobile_number: "1",          landline_number: "1" },
  { name: "DAIRY PRODUCT",        address: "NALKHEDA",  city: "NALKHEDA", contact_person: "",            mobile_number: "1",          landline_number: "1" },
  { name: "KIRANA",               address: "NALKHEDA",  city: "NALKHEDA", contact_person: "",            mobile_number: "1",          landline_number: "1" },
  { name: "VEGETABLE",            address: "NALKHEDA",  city: "NALKHEDA", contact_person: "1",           mobile_number: "1",          landline_number: "1" },
  { name: "RATHORE DISPOSAL HOUSE", address: "NALKHEDA", city: "NALKHEDA", contact_person: "",            mobile_number: "9755555881", landline_number: "" },
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_vendors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      address VARCHAR(255) DEFAULT NULL,
      city VARCHAR(100) DEFAULT NULL,
      contact_person VARCHAR(150) DEFAULT NULL,
      mobile_number VARCHAR(32) DEFAULT NULL,
      landline_number VARCHAR(32) DEFAULT NULL,
      gstin VARCHAR(20) DEFAULT NULL,
      email VARCHAR(191) DEFAULT NULL,
      opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT NULL AFTER name").catch(() => {});
  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT NULL AFTER address").catch(() => {});
  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150) DEFAULT NULL AFTER city").catch(() => {});
  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(32) DEFAULT NULL AFTER contact_person").catch(() => {});
  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS landline_number VARCHAR(32) DEFAULT NULL AFTER mobile_number").catch(() => {});
  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS gstin VARCHAR(20) DEFAULT NULL AFTER landline_number").catch(() => {});
  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS email VARCHAR(191) DEFAULT NULL AFTER gstin").catch(() => {});
  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER email").catch(() => {});
  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER opening_balance").catch(() => {});
  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER is_active").catch(() => {});
  await runQuery("ALTER TABLE inventory_vendors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at").catch(() => {});

  const rows = await runQuery("SELECT COUNT(*) AS count FROM inventory_vendors");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const s of SEEDS) {
      await runQuery(
        `INSERT INTO inventory_vendors
           (name, address, city, contact_person, mobile_number, landline_number)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [s.name, s.address, s.city, s.contact_person, s.mobile_number, s.landline_number],
      );
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  address: r.address || "",
  city: r.city || "",
  contact_person: r.contact_person || "",
  mobile_number: r.mobile_number || "",
  landline_number: r.landline_number || "",
  gstin: r.gstin || "",
  email: r.email || "",
  opening_balance: Number(r.opening_balance || 0),
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Vendor name is required");
  return {
    name,
    address: String(body?.address || "").trim() || null,
    city: String(body?.city || "").trim() || null,
    contact_person: String(body?.contact_person || "").trim() || null,
    mobile_number: String(body?.mobile_number || "").trim() || null,
    landline_number: String(body?.landline_number || "").trim() || null,
    gstin: String(body?.gstin || "").trim() || null,
    email: String(body?.email || "").trim() || null,
    opening_balance: Number(body?.opening_balance) || 0,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const list = async () => {
  const rows = await runQuery("SELECT * FROM inventory_vendors ORDER BY id ASC");
  return rows.map(mapRow);
};

const getById = async (id) => {
  const rows = await runQuery("SELECT * FROM inventory_vendors WHERE id = ?", [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO inventory_vendors
       (name, address, city, contact_person, mobile_number, landline_number, gstin, email, opening_balance, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.name, p.address, p.city, p.contact_person, p.mobile_number, p.landline_number, p.gstin, p.email, p.opening_balance, p.is_active],
  );
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE inventory_vendors SET
       name = ?, address = ?, city = ?, contact_person = ?,
       mobile_number = ?, landline_number = ?, gstin = ?, email = ?,
       opening_balance = ?, is_active = ?
     WHERE id = ?`,
    [p.name, p.address, p.city, p.contact_person, p.mobile_number, p.landline_number, p.gstin, p.email, p.opening_balance, p.is_active, id],
  );
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM inventory_vendors WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, getById, create, update, remove };
