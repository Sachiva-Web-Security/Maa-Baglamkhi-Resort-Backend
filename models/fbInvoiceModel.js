const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const STATUSES = ["draft", "paid", "cancelled"];
const TYPES = ["Table", "Parcel", "CS"];

const columnExists = async (table, column) => {
  const rows = await runQuery(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  return Array.isArray(rows) && rows.length > 0;
};

const addColumn = async (table, column, definition) => {
  if (!(await columnExists(table, column))) {
    await runQuery(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_no VARCHAR(64) NOT NULL UNIQUE,
      invoice_date DATETIME NOT NULL,
      type VARCHAR(16) NOT NULL DEFAULT 'Table',
      customer_name VARCHAR(191) DEFAULT NULL,
      customer_phone VARCHAR(32) DEFAULT NULL,
      table_id INT DEFAULT NULL,
      table_label VARCHAR(64) DEFAULT NULL,
      captain_id INT DEFAULT NULL,
      invoice_group_id INT DEFAULT NULL,
      sub_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      delivery_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
      container_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
      service_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
      no_service_charge TINYINT(1) NOT NULL DEFAULT 0,
      round_off DECIMAL(8,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      net_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      original_bill_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      payment_mode VARCHAR(64) DEFAULT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'paid',
      settled TINYINT(1) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (table_id) REFERENCES fb_tables(id) ON DELETE SET NULL,
      FOREIGN KEY (captain_id) REFERENCES fb_captains(id) ON DELETE SET NULL,
      FOREIGN KEY (invoice_group_id) REFERENCES fb_invoice_groups(id) ON DELETE SET NULL
    )
  `);

  // Migrations for upgrades on existing dev DBs
  await addColumn("fb_invoices", "type", "VARCHAR(16) NOT NULL DEFAULT 'Table'");
  await addColumn("fb_invoices", "table_label", "VARCHAR(64) DEFAULT NULL");
  await addColumn("fb_invoices", "delivery_charge", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await addColumn("fb_invoices", "container_charge", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await addColumn("fb_invoices", "service_charge", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await addColumn("fb_invoices", "no_service_charge", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumn("fb_invoices", "round_off", "DECIMAL(8,2) NOT NULL DEFAULT 0");
  await addColumn("fb_invoices", "net_total", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await addColumn("fb_invoices", "original_bill_total", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await addColumn("fb_invoices", "settled", "TINYINT(1) NOT NULL DEFAULT 0");

  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_invoice_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      item_id INT DEFAULT NULL,
      item_name VARCHAR(191) NOT NULL,
      qty DECIMAL(10,3) NOT NULL DEFAULT 1,
      rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES fb_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES fb_items(id) ON DELETE SET NULL
    )
  `);
  await addColumn("fb_invoice_items", "discount", "DECIMAL(10,2) NOT NULL DEFAULT 0");

  // Seed sample invoices on first run
  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_invoices");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const captains = await runQuery("SELECT id, name FROM fb_captains ORDER BY id ASC");
    const reception = captains.find((c) => c.name === "RECEPTION") || captains[0];
    const tables = await runQuery("SELECT id, name FROM fb_tables ORDER BY id ASC LIMIT 4");
    const items = await runQuery("SELECT id, name, current_rate FROM fb_items ORDER BY id ASC");
    const invoiceGroup = await runQuery("SELECT id FROM fb_invoice_groups WHERE name = 'Food' LIMIT 1");
    const invGroupId = invoiceGroup?.[0]?.id || null;

    const pick = (n) => items[n % Math.max(items.length, 1)];
    const dtStr = (d) => d.toISOString().slice(0, 19).replace("T", " ");
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const at = (h, m, s) => new Date(`${yyyy}-${mm}-${dd}T${h}:${m}:${s}`);

    const samples = [
      {
        no: "10302", type: "Table", table_label: "6", date: at("16","18","25"),
        items: [
          { name: "Mineral Water 1 Ltr.", qty: 1, rate: 19.10 },
          { name: "Green Salad",          qty: 1, rate: 60.00 },
          { name: "Dal Fry",              qty: 1, rate: 140.00 },
          { name: "Tandoori Roti Butter", qty: 12, rate: 19.00 },
          { name: "Jeera Rice",           qty: 1, rate: 140.00 },
          { name: "half dal",             qty: 1, rate: 80.00 },
        ],
        netTotal: 700.00,
      },
      { no: "10303", type: "Table",  table_label: "10", date: at("15","23","36"), items: [{ name: pick(0).name, qty: 8, rate: 125 }], netTotal: 1003 },
      { no: "10304", type: "Table",  table_label: "15", date: at("14","52","24"), items: [{ name: pick(1).name, qty: 12, rate: 150 }], netTotal: 1806 },
      { no: "10305", type: "Table",  table_label: "11", date: at("14","30","46"), items: [{ name: pick(2).name, qty: 8, rate: 198 }], netTotal: 1588 },
      { no: "10306", type: "Table",  table_label: "10", date: at("14","10","18"), items: [{ name: pick(0).name, qty: 5, rate: 107 }], netTotal: 536 },
      { no: "10307", type: "Parcel", table_label: "PARSAL PICK UP 2", date: at("13","44","17"), items: [{ name: pick(3).name, qty: 1, rate: 252 }], netTotal: 252 },
      { no: "10308", type: "Parcel", table_label: "PARSAL PICK UP 1", date: at("12","44","40"), items: [{ name: pick(2).name, qty: 1, rate: 116 }], netTotal: 116 },
      { no: "10309", type: "Table",  table_label: "5",  date: at("12","25","39"), items: [{ name: pick(1).name, qty: 3, rate: 82  }], netTotal: 246 },
      { no: "10310", type: "Table",  table_label: "6",  date: at("11","58","59"), items: [{ name: pick(0).name, qty: 3, rate: 82  }], netTotal: 247 },
      { no: "10311", type: "Table",  table_label: "ROOM 117", date: at("11","27","25"), items: [{ name: pick(3).name, qty: 3, rate: 29  }], netTotal: 87 },
      { no: "10312", type: "Table",  table_label: "ROOM 109", date: at("11","20","09"), items: [{ name: pick(2).name, qty: 2, rate: 182 }], netTotal: 364 },
      { no: "10313", type: "Table",  table_label: "ROOM 103", date: at("11","19","57"), items: [{ name: pick(1).name, qty: 7, rate: 199 }], netTotal: 1390 },
      { no: "10314", type: "Table",  table_label: "ROOM 105", date: at("08","39","57"), items: [{ name: pick(0).name, qty: 2, rate: 80  }], netTotal: 160 },
    ];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const captainId = reception?.id || null;
      const tableId = tables[i % tables.length]?.id || null;
      const subTotal = Number(s.items.reduce((sum, it) => sum + it.qty * it.rate, 0).toFixed(2));
      const taxAmount = 0;
      const discountAmount = 0;
      const total = subTotal + taxAmount - discountAmount;
      const roundOff = Number((s.netTotal - total).toFixed(2));
      const ins = await runQuery(
        `INSERT INTO fb_invoices
           (invoice_no, invoice_date, type, customer_name, customer_phone, table_id, table_label, captain_id,
            invoice_group_id, sub_total, tax_amount, discount_amount, delivery_charge, container_charge,
            service_charge, no_service_charge, round_off, total_amount, net_total, original_bill_total,
            payment_mode, status, settled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.no, dtStr(s.date), s.type, "", "", tableId, s.table_label, captainId,
          invGroupId, subTotal, taxAmount, discountAmount, 0, 0,
          0, 0, roundOff, total, s.netTotal, s.netTotal,
          "Cash", "paid", 1,
        ],
      );
      for (const it of s.items) {
        await runQuery(
          `INSERT INTO fb_invoice_items (invoice_id, item_id, item_name, qty, rate, discount, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ins.insertId, null, it.name, it.qty, it.rate, 0, Number((it.qty * it.rate).toFixed(2))],
        );
      }
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  invoice_no: r.invoice_no,
  invoice_date: r.invoice_date,
  type: r.type || "Table",
  customer_name: r.customer_name || "",
  customer_phone: r.customer_phone || "",
  table_id: r.table_id,
  table_label: r.table_label || r.table_name || "",
  table_name: r.table_name || "",
  captain_id: r.captain_id,
  captain_name: r.captain_name || "",
  invoice_group_id: r.invoice_group_id,
  invoice_group_name: r.invoice_group_name || "",
  sub_total: Number(r.sub_total || 0),
  tax_amount: Number(r.tax_amount || 0),
  discount_amount: Number(r.discount_amount || 0),
  delivery_charge: Number(r.delivery_charge || 0),
  container_charge: Number(r.container_charge || 0),
  service_charge: Number(r.service_charge || 0),
  no_service_charge: Number(r.no_service_charge) === 1,
  round_off: Number(r.round_off || 0),
  total_amount: Number(r.total_amount || 0),
  net_total: Number(r.net_total || 0),
  original_bill_total: Number(r.original_bill_total || 0),
  payment_mode: r.payment_mode || "",
  status: r.status || "draft",
  settled: Number(r.settled) === 1,
  notes: r.notes || "",
});

const baseSelect = `
  SELECT i.*,
         t.name AS table_name,
         c.name AS captain_name,
         ig.name AS invoice_group_name,
         (SELECT COUNT(*) FROM fb_invoice_items WHERE invoice_id = i.id) AS total_items
    FROM fb_invoices i
    LEFT JOIN fb_tables t ON t.id = i.table_id
    LEFT JOIN fb_captains c ON c.id = i.captain_id
    LEFT JOIN fb_invoice_groups ig ON ig.id = i.invoice_group_id
`;

const list = async ({
  from = "", to = "", invoice_no = "", customer = "", status = "",
  table_no = "", contact = "", type = "",
} = {}) => {
  const where = [];
  const params = [];
  if (from)       { where.push("DATE(i.invoice_date) >= ?"); params.push(from); }
  if (to)         { where.push("DATE(i.invoice_date) <= ?"); params.push(to); }
  if (invoice_no) { where.push("i.invoice_no LIKE ?");       params.push(`%${invoice_no}%`); }
  if (customer)   { where.push("i.customer_name LIKE ?");    params.push(`%${customer}%`); }
  if (contact)    { where.push("i.customer_phone LIKE ?");   params.push(`%${contact}%`); }
  if (table_no)   { where.push("(i.table_label LIKE ? OR t.name LIKE ?)"); params.push(`%${table_no}%`, `%${table_no}%`); }
  if (status && STATUSES.includes(status)) { where.push("i.status = ?"); params.push(status); }
  if (type && TYPES.includes(type)) { where.push("i.type = ?"); params.push(type); }

  const rows = await runQuery(
    `${baseSelect} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY i.invoice_date DESC, i.id DESC`,
    params,
  );
  return rows.map((r) => ({ ...mapRow(r), total_items: Number(r.total_items || 0) }));
};

const getById = async (id) => {
  const rows = await runQuery(`${baseSelect} WHERE i.id = ?`, [id]);
  if (!rows[0]) return null;
  const inv = mapRow(rows[0]);
  const items = await runQuery(
    "SELECT id, invoice_id, item_id, item_name, qty, rate, discount, amount FROM fb_invoice_items WHERE invoice_id = ? ORDER BY id ASC",
    [id],
  );
  inv.items = items.map((r) => ({
    id: r.id,
    item_id: r.item_id,
    item_name: r.item_name,
    qty: Number(r.qty),
    rate: Number(r.rate),
    discount: Number(r.discount || 0),
    amount: Number(r.amount),
  }));
  return inv;
};

const update = async (id, body) => {
  const items = Array.isArray(body?.items) ? body.items : [];
  const subTotal = items.reduce(
    (sum, it) => sum + Number(it.qty || 0) * Number(it.rate || 0) - Number(it.discount || 0),
    0,
  );
  const tax = Number(body?.tax_amount) || 0;
  const discount = Number(body?.discount_amount) || 0;
  const deliveryCharge = Number(body?.delivery_charge) || 0;
  const containerCharge = Number(body?.container_charge) || 0;
  const serviceCharge = Number(body?.service_charge) || 0;
  const noServiceCharge = body?.no_service_charge ? 1 : 0;
  const total = subTotal + tax - discount + deliveryCharge + containerCharge + (noServiceCharge ? 0 : serviceCharge);
  const netTotal = body?.net_total != null
    ? Number(body.net_total)
    : Math.round(total);
  const roundOff = Number((netTotal - total).toFixed(2));

  await runQuery(
    `UPDATE fb_invoices SET
        type = ?, customer_name = ?, customer_phone = ?,
        sub_total = ?, tax_amount = ?, discount_amount = ?,
        delivery_charge = ?, container_charge = ?, service_charge = ?,
        no_service_charge = ?, round_off = ?, total_amount = ?,
        net_total = ?, original_bill_total = COALESCE(NULLIF(original_bill_total, 0), ?),
        status = ?, settled = ?, notes = ?
      WHERE id = ?`,
    [
      body?.type || "Table",
      body?.customer_name || "",
      body?.customer_phone || "",
      subTotal, tax, discount,
      deliveryCharge, containerCharge, serviceCharge,
      noServiceCharge, roundOff, total,
      netTotal, netTotal,
      STATUSES.includes(body?.status) ? body.status : "paid",
      body?.settled ? 1 : 0,
      body?.notes || "",
      id,
    ],
  );

  // Replace line items
  await runQuery("DELETE FROM fb_invoice_items WHERE invoice_id = ?", [id]);
  for (const it of items) {
    const qty = Number(it.qty || 0);
    const rate = Number(it.rate || 0);
    const disc = Number(it.discount || 0);
    const amount = Number((qty * rate - disc).toFixed(2));
    await runQuery(
      `INSERT INTO fb_invoice_items (invoice_id, item_id, item_name, qty, rate, discount, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, it.item_id || null, String(it.item_name || "").trim(), qty, rate, disc, amount],
    );
  }
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_invoices WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, getById, update, remove };
