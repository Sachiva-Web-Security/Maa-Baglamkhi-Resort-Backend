const db = require("../config/db");

const Inventory = {

  // ── Inventory Items ─────────────────────────────────────────────────────────

  create: (data, callback) => {
    const sql = `
      INSERT INTO inventory
        (name, category, stock, unit, price, reorder_point, expiry, branch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [data.name, data.category, data.stock, data.unit,
       data.price, data.reorderPoint ?? 10, data.expiry || null, data.branch],
      callback
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
      callback
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
      callback
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
      [data.name, data.category, data.stock, data.unit,
       data.price, data.reorderPoint ?? 10, data.expiry || null, data.branch, id],
      callback
    );
  },

  delete: (id, callback) => {
    db.query("DELETE FROM inventory WHERE id=?", [id], callback);
  },

  // ── Low Stock Alerts ────────────────────────────────────────────────────────

  getLowStock: (callback) => {
    db.query(
      `SELECT id, name, category, stock, unit, reorder_point AS reorderPoint, branch
       FROM inventory
       WHERE stock <= reorder_point
       ORDER BY stock ASC`,
      callback
    );
  },

  // ── Expiry Tracking ─────────────────────────────────────────────────────────

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
      callback
    );
  },

  // ── Waste / Spoilage Log ────────────────────────────────────────────────────

  logWaste: (data, callback) => {
    const sql = `
      INSERT INTO inventory_waste_log
        (item_name, quantity, unit, reason, store, remarks, waste_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [data.itemName, data.quantity, data.unit || null, data.reason,
       data.store || null, data.remarks || null, data.date, data.createdBy || "system"],
      callback
    );
  },

  getWasteLogs: (callback) => {
    db.query(
      `SELECT id, item_name AS itemName, quantity, unit, reason, store, remarks,
              DATE_FORMAT(waste_date, '%Y-%m-%d') AS date, created_by AS createdBy,
              created_at AS createdAt
       FROM inventory_waste_log
       ORDER BY waste_date DESC`,
      callback
    );
  },

  // ── Purchase Orders ─────────────────────────────────────────────────────────

  createPurchaseOrder: (data, callback) => {
    const sql = `
      INSERT INTO inventory_purchase_orders
        (po_number, vendor, item_name, quantity, unit, rate, expected_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [data.poNumber, data.vendor, data.itemName, data.quantity,
       data.unit || null, data.rate, data.expectedDate || null,
       data.status || "Draft", data.createdBy || "system"],
      callback
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
      callback
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
      [data.poNumber, data.vendor, data.itemName, data.quantity,
       data.unit || null, data.rate, data.expectedDate || null, data.status, id],
      callback
    );
  },

  deletePurchaseOrder: (id, callback) => {
    db.query("DELETE FROM inventory_purchase_orders WHERE id=?", [id], callback);
  },

  // ── Stock Audit ─────────────────────────────────────────────────────────────

  saveAuditEntry: (data, callback) => {
    const sql = `
      INSERT INTO inventory_stock_audit
        (item_id, item_name, system_stock, physical_stock, variance, unit, remarks, audit_date, audited_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)
    `;
    db.query(
      sql,
      [data.itemId, data.itemName, data.systemStock, data.physicalStock,
       data.variance, data.unit, data.remarks || null, data.auditedBy || "system"],
      callback
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
       ORDER BY audit_date DESC`,
      callback
    );
  },

  // ── Inter-Department Stock Transfer ────────────────────────────────────────

  recordTransfer: (data, callback) => {
    const sql = `
      INSERT INTO inventory_transfers
        (item_name, from_store, to_store, quantity, unit, approved_by, transfer_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [data.itemName, data.fromStore, data.toStore, data.quantity,
       data.unit || null, data.approvedBy || null, data.date, data.notes || null],
      callback
    );
  },

  getTransfers: (callback) => {
    db.query(
      `SELECT id, item_name AS itemName, from_store AS fromStore, to_store AS toStore,
              quantity, unit, approved_by AS approvedBy,
              DATE_FORMAT(transfer_date, '%Y-%m-%d') AS date, notes
       FROM inventory_transfers
       ORDER BY transfer_date DESC`,
      callback
    );
  },
};

module.exports = Inventory;