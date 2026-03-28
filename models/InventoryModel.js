const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

const columnExists = async (tableName, columnName) => {
  const rows = await runQuery(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName],
  );
  return Number(rows?.[0]?.count || 0) > 0;
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(120) NULL,
      stock DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit VARCHAR(60) NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      reorder_point DECIMAL(10,2) NOT NULL DEFAULT 10,
      expiry DATE NULL,
      branch VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const inventoryColumns = [
    ["category", "VARCHAR(120) NULL"],
    ["stock", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
    ["unit", "VARCHAR(60) NULL"],
    ["price", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
    ["reorder_point", "DECIMAL(10,2) NOT NULL DEFAULT 10"],
    ["expiry", "DATE NULL"],
    ["branch", "VARCHAR(120) NULL"],
    ["created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"],
    ["updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"],
  ];

  for (const [columnName, definition] of inventoryColumns) {
    if (!(await columnExists("inventory", columnName))) {
      await runQuery(`ALTER TABLE inventory ADD COLUMN ${columnName} ${definition}`);
    }
  }

  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_waste_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_name VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit VARCHAR(60) NULL,
      reason VARCHAR(255) NOT NULL,
      store VARCHAR(120) NULL,
      remarks TEXT NULL,
      waste_date DATE NULL,
      created_by VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      po_number VARCHAR(120) NOT NULL,
      vendor VARCHAR(255) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit VARCHAR(60) NULL,
      rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      expected_date DATE NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Draft',
      created_by VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_stock_audit (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_id INT NULL,
      item_name VARCHAR(255) NOT NULL,
      system_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
      physical_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
      variance DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit VARCHAR(60) NULL,
      remarks TEXT NULL,
      audit_date DATE NULL,
      audited_by VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_transfers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_name VARCHAR(255) NOT NULL,
      from_store VARCHAR(120) NOT NULL,
      to_store VARCHAR(120) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit VARCHAR(60) NULL,
      approved_by VARCHAR(120) NULL,
      transfer_date DATE NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const Inventory = {
  ensureSchema,

  create: (data, callback) => {
    const sql = `
      INSERT INTO inventory
        (name, category, stock, unit, price, reorder_point, expiry, branch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        data.name,
        data.category,
        data.stock,
        data.unit,
        data.price,
        data.reorderPoint ?? 10,
        data.expiry || null,
        data.branch,
      ],
      callback,
    );
  },

  getAll: (callback) => {
    db.query(
      `SELECT id, name, category, stock, unit, price,
              reorder_point AS reorderPoint,
              DATE_FORMAT(expiry, '%Y-%m-%d') AS expiry,
              branch,
              CASE WHEN stock <= reorder_point THEN 1 ELSE 0 END AS isLowStock
       FROM inventory
       ORDER BY name`,
      callback,
    );
  },

  getById: (id, callback) => {
    db.query(
      `SELECT id, name, category, stock, unit, price,
              reorder_point AS reorderPoint,
              DATE_FORMAT(expiry, '%Y-%m-%d') AS expiry,
              branch
       FROM inventory WHERE id = ?`,
      [id],
      callback,
    );
  },

  update: (id, data, callback) => {
    const sql = `
      UPDATE inventory
      SET name=?, category=?, stock=?, unit=?, price=?,
          reorder_point=?, expiry=?, branch=?
      WHERE id=?
    `;
    db.query(
      sql,
      [
        data.name,
        data.category,
        data.stock,
        data.unit,
        data.price,
        data.reorderPoint ?? 10,
        data.expiry || null,
        data.branch,
        id,
      ],
      callback,
    );
  },

  delete: (id, callback) => {
    db.query("DELETE FROM inventory WHERE id = ?", [id], callback);
  },

  getLowStock: (callback) => {
    db.query(
      `SELECT id, name, category, stock, unit, reorder_point AS reorderPoint, branch
       FROM inventory
       WHERE stock <= reorder_point
       ORDER BY stock ASC`,
      callback,
    );
  },

  getExpiringItems: (daysAhead = 30, callback) => {
    db.query(
      `SELECT id, name, category, stock, unit, branch,
              DATE_FORMAT(expiry, '%Y-%m-%d') AS expiry,
              DATEDIFF(expiry, CURDATE()) AS daysToExpiry
       FROM inventory
       WHERE expiry IS NOT NULL
         AND expiry <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY expiry ASC`,
      [daysAhead],
      callback,
    );
  },

  logWaste: (data, callback) => {
    const sql = `
      INSERT INTO inventory_waste_log
        (item_name, quantity, unit, reason, store, remarks, waste_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        data.itemName,
        data.quantity,
        data.unit || null,
        data.reason,
        data.store || null,
        data.remarks || null,
        data.date || null,
        data.createdBy || "system",
      ],
      callback,
    );
  },

  getWasteLogs: (callback) => {
    db.query(
      `SELECT id, item_name AS itemName, quantity, unit, reason, store, remarks,
              DATE_FORMAT(waste_date, '%Y-%m-%d') AS date, created_by AS createdBy,
              created_at AS createdAt
       FROM inventory_waste_log
       ORDER BY waste_date DESC, created_at DESC`,
      callback,
    );
  },

  createPurchaseOrder: (data, callback) => {
    const sql = `
      INSERT INTO inventory_purchase_orders
        (po_number, vendor, item_name, quantity, unit, rate, expected_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        data.poNumber,
        data.vendor,
        data.itemName,
        data.quantity,
        data.unit || null,
        data.rate,
        data.expectedDate || null,
        data.status || "Draft",
        data.createdBy || "system",
      ],
      callback,
    );
  },

  getPurchaseOrders: (callback) => {
    db.query(
      `SELECT id, po_number AS poNumber, vendor, item_name AS itemName,
              quantity, unit, rate,
              DATE_FORMAT(expected_date, '%Y-%m-%d') AS expectedDate,
              status, created_by AS createdBy,
              created_at AS createdAt
       FROM inventory_purchase_orders
       ORDER BY created_at DESC`,
      callback,
    );
  },

  updatePurchaseOrder: (id, data, callback) => {
    const sql = `
      UPDATE inventory_purchase_orders
      SET po_number=?, vendor=?, item_name=?, quantity=?, unit=?,
          rate=?, expected_date=?, status=?
      WHERE id=?
    `;
    db.query(
      sql,
      [
        data.poNumber,
        data.vendor,
        data.itemName,
        data.quantity,
        data.unit || null,
        data.rate,
        data.expectedDate || null,
        data.status,
        id,
      ],
      callback,
    );
  },

  deletePurchaseOrder: (id, callback) => {
    db.query("DELETE FROM inventory_purchase_orders WHERE id = ?", [id], callback);
  },

  saveAuditEntry: (data, callback) => {
    const sql = `
      INSERT INTO inventory_stock_audit
        (item_id, item_name, system_stock, physical_stock, variance, unit, remarks, audit_date, audited_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)
    `;
    db.query(
      sql,
      [
        data.itemId,
        data.itemName,
        data.systemStock,
        data.physicalStock,
        data.variance,
        data.unit,
        data.remarks || null,
        data.auditedBy || "system",
      ],
      callback,
    );
  },

  getAuditReport: (callback) => {
    db.query(
      `SELECT id, item_id AS itemId, item_name AS itemName,
              system_stock AS systemStock, physical_stock AS physicalStock,
              variance, unit, remarks,
              DATE_FORMAT(audit_date, '%Y-%m-%d') AS auditDate,
              audited_by AS auditedBy
       FROM inventory_stock_audit
       ORDER BY audit_date DESC, created_at DESC`,
      callback,
    );
  },

  recordTransfer: (data, callback) => {
    const sql = `
      INSERT INTO inventory_transfers
        (item_name, from_store, to_store, quantity, unit, approved_by, transfer_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        data.itemName,
        data.fromStore,
        data.toStore,
        data.quantity,
        data.unit || null,
        data.approvedBy || null,
        data.date || null,
        data.notes || null,
      ],
      callback,
    );
  },

  getTransfers: (callback) => {
    db.query(
      `SELECT id, item_name AS itemName, from_store AS fromStore, to_store AS toStore,
              quantity, unit, approved_by AS approvedBy,
              DATE_FORMAT(transfer_date, '%Y-%m-%d') AS date, notes
       FROM inventory_transfers
       ORDER BY transfer_date DESC, created_at DESC`,
      callback,
    );
  },
};

module.exports = Inventory;
