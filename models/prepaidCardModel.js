const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS prepaid_cards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      card_number VARCHAR(100) NOT NULL UNIQUE,
      holder_name VARCHAR(255) DEFAULT NULL,
      mobile VARCHAR(50) DEFAULT NULL,
      amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      balance DECIMAL(15,2) NOT NULL DEFAULT 0,
      issue_date DATE DEFAULT NULL,
      expiry_date DATE DEFAULT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const formatDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const mapRow = (r) => ({
  id: r.id,
  card_number: r.card_number || "",
  holder_name: r.holder_name || "",
  mobile: r.mobile || "",
  amount: Number(r.amount) || 0,
  balance: Number(r.balance) || 0,
  issue_date: formatDate(r.issue_date),
  expiry_date: formatDate(r.expiry_date),
  status: r.status || "Active",
});

const sanitize = (body, isUpdate = false) => {
  const card_number = String(body?.card_number || "").trim();
  if (!card_number) throw new Error("Card number is required");
  const amount = Number(body?.amount || 0);
  let balance;
  if (body?.balance === undefined || body?.balance === null || body?.balance === "") {
    balance = isUpdate ? null : amount;
  } else {
    balance = Number(body.balance);
  }
  if (Number.isNaN(amount)) throw new Error("Amount must be a number");
  if (balance !== null && Number.isNaN(balance)) throw new Error("Balance must be a number");
  return {
    card_number,
    holder_name: String(body?.holder_name || "").trim() || null,
    mobile: String(body?.mobile || "").trim() || null,
    amount,
    balance: balance === null ? amount : balance,
    issue_date: body?.issue_date ? formatDate(body.issue_date) : null,
    expiry_date: body?.expiry_date ? formatDate(body.expiry_date) : null,
    status: String(body?.status || "Active").trim() || "Active",
  };
};

const list = async () => {
  const rows = await runQuery("SELECT * FROM prepaid_cards ORDER BY id DESC");
  return rows.map(mapRow);
};

const create = async (body) => {
  const p = sanitize(body, false);
  const result = await runQuery(
    `INSERT INTO prepaid_cards
       (card_number, holder_name, mobile, amount, balance, issue_date, expiry_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.card_number, p.holder_name, p.mobile, p.amount, p.balance, p.issue_date, p.expiry_date, p.status],
  );
  const rows = await runQuery("SELECT * FROM prepaid_cards WHERE id = ?", [result.insertId]);
  return mapRow(rows[0]);
};

const update = async (id, body) => {
  const p = sanitize(body, true);
  await runQuery(
    `UPDATE prepaid_cards
        SET card_number = ?, holder_name = ?, mobile = ?, amount = ?,
            balance = ?, issue_date = ?, expiry_date = ?, status = ?
      WHERE id = ?`,
    [p.card_number, p.holder_name, p.mobile, p.amount, p.balance, p.issue_date, p.expiry_date, p.status, id],
  );
  const rows = await runQuery("SELECT * FROM prepaid_cards WHERE id = ?", [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const remove = async (id) => {
  await runQuery("DELETE FROM prepaid_cards WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove };
