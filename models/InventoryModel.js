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

const tableExists = async (tableName) => {
  const rows = await runQuery(
    `SELECT COUNT(*) AS count
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName],
  );
  return Number(rows?.[0]?.count || 0) > 0;
};

const getConnection = () =>
  new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) return reject(err);
      resolve(connection);
    });
  });

const queryWithConnection = (connection, sql, params = []) =>
  new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

const beginTransaction = (connection) =>
  new Promise((resolve, reject) => {
    connection.beginTransaction((err) => {
      if (err) return reject(err);
      resolve();
    });
  });

const commitTransaction = (connection) =>
  new Promise((resolve, reject) => {
    connection.commit((err) => {
      if (err) return reject(err);
      resolve();
    });
  });

const rollbackTransaction = (connection) =>
  new Promise((resolve) => {
    connection.rollback(() => resolve());
  });

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const stringValue = String(value).trim();
  if (!stringValue) return null;
  const dateOnly = stringValue.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null;
};

const findInventoryItem = async (connection, itemId, itemName) => {
  if (itemId) {
    const byId = await queryWithConnection(
      connection,
      "SELECT id, name, stock, unit FROM inventory WHERE id = ? LIMIT 1",
      [itemId],
    );
    if (byId.length) return byId[0];
  }

  if (itemName) {
    const byName = await queryWithConnection(
      connection,
      "SELECT id, name, stock, unit FROM inventory WHERE LOWER(name) = LOWER(?) ORDER BY id ASC LIMIT 1",
      [itemName],
    );
    if (byName.length) return byName[0];
  }

  return null;
};

const getInventoryStock = async (connection, itemId) => {
  const rows = await queryWithConnection(connection, "SELECT stock FROM inventory WHERE id = ? LIMIT 1", [itemId]);
  return Number(rows?.[0]?.stock || 0);
};

const getInventoryItemDetails = async (connection, itemId) => {
  const rows = await queryWithConnection(
    connection,
    "SELECT id, name, stock, unit, price, branch FROM inventory WHERE id = ? LIMIT 1",
    [itemId],
  );
  return rows[0] || null;
};

const syncInventoryExpiryFromInwards = async (connection, itemId) => {
  if (!itemId) return null;
  const rows = await queryWithConnection(
    connection,
    `
      SELECT DATE_FORMAT(MIN(expiry_date), '%Y-%m-%d') AS nextExpiry
      FROM inventory_vendor_inwards
      WHERE item_id = ?
        AND expiry_date IS NOT NULL
    `,
    [itemId],
  );
  const nextExpiry = rows?.[0]?.nextExpiry || null;
  await queryWithConnection(connection, "UPDATE inventory SET expiry = ? WHERE id = ?", [nextExpiry, itemId]);
  return nextExpiry;
};

const ensureAccountsMirrorSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS vendor_payment_records (
      id INT NOT NULL AUTO_INCREMENT,
      vendor_name VARCHAR(255) NOT NULL,
      invoice_ref VARCHAR(120) DEFAULT NULL,
      payment_date DATE NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      payment_mode VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
      status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
      notes TEXT NULL,
      source_module VARCHAR(80) NULL,
      source_id INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_vendor_payment_date (payment_date),
      INDEX idx_vendor_payment_vendor (vendor_name),
      INDEX idx_vendor_payment_source (source_module, source_id)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INT NOT NULL AUTO_INCREMENT,
      po_number VARCHAR(100) NOT NULL,
      vendor_name VARCHAR(255) NOT NULL,
      order_date DATE NOT NULL,
      expected_date DATE DEFAULT NULL,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'Draft',
      notes TEXT NULL,
      source_module VARCHAR(80) NULL,
      source_id INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_purchase_order_number (po_number),
      INDEX idx_purchase_order_date (order_date),
      INDEX idx_purchase_order_source (source_module, source_id)
    )
  `);

  if (await tableExists("vendor_payment_records")) {
    if (!(await columnExists("vendor_payment_records", "source_module"))) {
      await runQuery("ALTER TABLE vendor_payment_records ADD COLUMN source_module VARCHAR(80) NULL AFTER notes");
    }
    if (!(await columnExists("vendor_payment_records", "source_id"))) {
      await runQuery("ALTER TABLE vendor_payment_records ADD COLUMN source_id INT NULL AFTER source_module");
    }
  }

  if (await tableExists("purchase_orders")) {
    if (!(await columnExists("purchase_orders", "source_module"))) {
      await runQuery("ALTER TABLE purchase_orders ADD COLUMN source_module VARCHAR(80) NULL AFTER notes");
    }
    if (!(await columnExists("purchase_orders", "source_id"))) {
      await runQuery("ALTER TABLE purchase_orders ADD COLUMN source_id INT NULL AFTER source_module");
    }
  }
};

const syncAccountsVendorPayment = async (paymentId, data) => {
  await ensureAccountsMirrorSchema();
  const payload = {
    vendor_name: data.vendorName || data.vendor || "",
    invoice_ref: data.invoiceRef || null,
    payment_date: data.paymentDate || null,
    amount: normalizeNumber(data.amount),
    payment_mode: data.paymentMode || "Bank Transfer",
    status: data.status || "Scheduled",
    notes: data.notes || null,
    source_module: "inventory",
    source_id: paymentId,
  };
  const existing = await runQuery(
    "SELECT id FROM vendor_payment_records WHERE source_module = 'inventory' AND source_id = ? LIMIT 1",
    [paymentId],
  );
  if (existing[0]?.id) {
    await runQuery("UPDATE vendor_payment_records SET ? WHERE id = ?", [payload, existing[0].id]);
  } else {
    await runQuery("INSERT INTO vendor_payment_records SET ?", [payload]);
  }
};

const deleteAccountsVendorPaymentMirror = async (paymentId) => {
  await ensureAccountsMirrorSchema();
  await runQuery("DELETE FROM vendor_payment_records WHERE source_module = 'inventory' AND source_id = ?", [paymentId]);
};

const syncAccountsPurchaseOrder = async (poId, data, fallbackOrderDate = null) => {
  await ensureAccountsMirrorSchema();
  const totalAmount = normalizeNumber(data.totalAmount, normalizeNumber(data.quantity) * normalizeNumber(data.rate));
  const payload = {
    po_number: data.poNumber,
    vendor_name: data.vendorName || data.vendor || "",
    order_date: data.orderDate || fallbackOrderDate || new Date().toISOString().slice(0, 10),
    expected_date: data.expectedDate || null,
    total_amount: totalAmount,
    status: data.status || "Draft",
    notes: data.notes || [data.itemName, data.quantity ? `Qty: ${data.quantity}` : null, data.unit || null].filter(Boolean).join(" | ") || null,
    source_module: "inventory",
    source_id: poId,
  };
  const existing = await runQuery(
    "SELECT id, order_date FROM purchase_orders WHERE source_module = 'inventory' AND source_id = ? LIMIT 1",
    [poId],
  );
  if (existing[0]?.id) {
    payload.order_date = data.orderDate || existing[0].order_date || payload.order_date;
    await runQuery("UPDATE purchase_orders SET ? WHERE id = ?", [payload, existing[0].id]);
  } else {
    await runQuery("INSERT INTO purchase_orders SET ?", [payload]);
  }
};

const deleteAccountsPurchaseOrderMirror = async (poId) => {
  await ensureAccountsMirrorSchema();
  await runQuery("DELETE FROM purchase_orders WHERE source_module = 'inventory' AND source_id = ?", [poId]);
};

const writeLedgerEntry = async (connection, entry) => {
  await queryWithConnection(
    connection,
    `
      INSERT INTO inventory_stock_ledger
        (item_id, item_name, reference_type, reference_id, direction, quantity, unit, vendor_name, location_name, rate, amount, balance_after, remarks, entry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      entry.itemId || null,
      entry.itemName || null,
      entry.referenceType,
      entry.referenceId || null,
      entry.direction || "IN",
      normalizeNumber(entry.quantity),
      entry.unit || null,
      entry.vendorName || null,
      entry.locationName || null,
      normalizeNumber(entry.rate),
      normalizeNumber(entry.amount),
      entry.balanceAfter == null ? null : normalizeNumber(entry.balanceAfter),
      entry.remarks || null,
      entry.entryDate || null,
    ],
  );
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(120) NULL,
      subcategory VARCHAR(120) NULL,
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
    ["subcategory", "VARCHAR(120) NULL"],
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
      item_id INT NULL,
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
      item_id INT NULL,
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

  if (!(await columnExists("inventory_waste_log", "item_id"))) {
    await runQuery("ALTER TABLE inventory_waste_log ADD COLUMN item_id INT NULL AFTER id");
  }

  if (!(await columnExists("inventory_transfers", "item_id"))) {
    await runQuery("ALTER TABLE inventory_transfers ADD COLUMN item_id INT NULL AFTER id");
  }
  await ensureAccountsMirrorSchema();

  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_vendor_inwards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      po_id INT NULL,
      po_number VARCHAR(120) NULL,
      vendor_name VARCHAR(255) NOT NULL,
      item_id INT NULL,
      item_name VARCHAR(255) NOT NULL,
      quantity_received DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit VARCHAR(60) NULL,
      rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      invoice_no VARCHAR(120) NULL,
      batch_no VARCHAR(120) NULL,
      expiry_date DATE NULL,
      received_date DATE NOT NULL,
      store VARCHAR(120) NULL,
      remarks TEXT NULL,
      stock_updated TINYINT(1) NOT NULL DEFAULT 0,
      created_by VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  if (!(await columnExists("inventory_vendor_inwards", "batch_no"))) {
    await runQuery("ALTER TABLE inventory_vendor_inwards ADD COLUMN batch_no VARCHAR(120) NULL AFTER invoice_no");
  }
  if (!(await columnExists("inventory_vendor_inwards", "expiry_date"))) {
    await runQuery("ALTER TABLE inventory_vendor_inwards ADD COLUMN expiry_date DATE NULL AFTER batch_no");
  }

  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_vendor_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor_name VARCHAR(255) NOT NULL,
      invoice_ref VARCHAR(120) NULL,
      payment_date DATE NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_mode VARCHAR(80) NOT NULL DEFAULT 'Bank Transfer',
      status VARCHAR(60) NOT NULL DEFAULT 'Scheduled',
      notes TEXT NULL,
      created_by VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_stock_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_id INT NULL,
      item_name VARCHAR(255) NULL,
      reference_type VARCHAR(80) NOT NULL,
      reference_id INT NULL,
      direction VARCHAR(10) NOT NULL DEFAULT 'IN',
      quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit VARCHAR(60) NULL,
      vendor_name VARCHAR(255) NULL,
      location_name VARCHAR(120) NULL,
      rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      balance_after DECIMAL(10,2) NULL,
      remarks TEXT NULL,
      entry_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const Inventory = {
  ensureSchema,

  create: (data, callback) => {
    (async () => {
      const connection = await getConnection();
      try {
        await beginTransaction(connection);

        const openingStock = normalizeNumber(data.stock);
        const rate = normalizeNumber(data.price);
        const result = await queryWithConnection(
          connection,
          `
            INSERT INTO inventory
              (name, category, subcategory, stock, unit, price, reorder_point, expiry, branch)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            data.name,
            data.category,
            data.subcategory || null,
            openingStock,
            data.unit,
            rate,
            data.reorderPoint ?? 10,
            data.expiry || null,
            data.branch,
          ],
        );

        if (openingStock > 0) {
          await writeLedgerEntry(connection, {
            itemId: result.insertId,
            itemName: data.name,
            referenceType: "opening_balance",
            referenceId: result.insertId,
            direction: "IN",
            quantity: openingStock,
            unit: data.unit || null,
            locationName: data.branch || null,
            rate,
            amount: rate * openingStock,
            balanceAfter: openingStock,
            remarks: data.adjustmentReason || "Opening stock",
            entryDate: normalizeDateOnly(data.openingDate) || new Date().toISOString().slice(0, 10),
          });
        }

        await commitTransaction(connection);
        callback(null, result);
      } catch (error) {
        await rollbackTransaction(connection);
        callback(error);
      } finally {
        connection.release();
      }
    })().catch((error) => callback(error));
  },

  getAll: (callback) => {
    db.query(
      `SELECT id, name, category, subcategory, stock, unit, price,
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
      `SELECT id, name, category, subcategory, stock, unit, price,
              reorder_point AS reorderPoint,
              DATE_FORMAT(expiry, '%Y-%m-%d') AS expiry,
              branch
       FROM inventory WHERE id = ?`,
      [id],
      callback,
    );
  },

  update: (id, data, callback) => {
    (async () => {
      const connection = await getConnection();
      try {
        await beginTransaction(connection);

        const existingRows = await queryWithConnection(
          connection,
          `SELECT id, name, stock, unit, price, branch
           FROM inventory
           WHERE id = ?
           LIMIT 1`,
          [id],
        );
        const existing = existingRows[0];
        if (!existing) {
          const error = new Error("Item not found.");
          error.statusCode = 404;
          throw error;
        }

        const nextStock = normalizeNumber(data.stock);
        const previousStock = normalizeNumber(existing.stock);
        const adjustmentQty = Number((nextStock - previousStock).toFixed(2));

        const result = await queryWithConnection(
          connection,
          `
            UPDATE inventory
            SET name=?, category=?, subcategory=?, stock=?, unit=?, price=?,
                reorder_point=?, expiry=?, branch=?
            WHERE id=?
          `,
          [
            data.name,
            data.category,
            data.subcategory || null,
            nextStock,
            data.unit,
            data.price,
            data.reorderPoint ?? 10,
            data.expiry || null,
            data.branch,
            id,
          ],
        );

        if (adjustmentQty !== 0) {
          const nextItem = await getInventoryItemDetails(connection, id);
          await writeLedgerEntry(connection, {
            itemId: id,
            itemName: data.name || existing.name,
            referenceType: adjustmentQty > 0 ? "stock_adjustment_in" : "stock_adjustment_out",
            referenceId: id,
            direction: adjustmentQty > 0 ? "IN" : "OUT",
            quantity: Math.abs(adjustmentQty),
            unit: data.unit || existing.unit || null,
            locationName: data.branch || existing.branch || null,
            rate: normalizeNumber(data.price, existing.price || 0),
            amount: normalizeNumber(data.price, existing.price || 0) * Math.abs(adjustmentQty),
            balanceAfter: Number(nextItem?.stock || nextStock),
            remarks: data.adjustmentReason || `Manual stock update from ${previousStock} to ${nextStock}`,
            entryDate: new Date().toISOString().slice(0, 10),
          });
        }

        await commitTransaction(connection);
        callback(null, result);
      } catch (error) {
        await rollbackTransaction(connection);
        callback(error);
      } finally {
        connection.release();
      }
    })().catch((error) => callback(error));
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

  createWasteEntry: async (data) => {
    const connection = await getConnection();
    try {
      await beginTransaction(connection);
      const quantity = normalizeNumber(data.quantity);
      const matchedItem = await findInventoryItem(connection, data.itemId, data.itemName);
      let balanceAfter = null;

      if (matchedItem && quantity > 0) {
        const currentStock = await getInventoryStock(connection, matchedItem.id);
        if (currentStock < quantity) {
          const error = new Error("Waste quantity current stock se zyada hai.");
          error.statusCode = 400;
          throw error;
        }
      }

      const result = await queryWithConnection(
        connection,
        `
          INSERT INTO inventory_waste_log
            (item_id, item_name, quantity, unit, reason, store, remarks, waste_date, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          matchedItem?.id || data.itemId || null,
          matchedItem?.name || data.itemName,
          quantity,
          data.unit || matchedItem?.unit || null,
          data.reason,
          data.store || null,
          data.remarks || null,
          data.date || null,
          data.createdBy || "system",
        ],
      );

      if (matchedItem && quantity > 0) {
        await queryWithConnection(
          connection,
          "UPDATE inventory SET stock = stock - ? WHERE id = ?",
          [quantity, matchedItem.id],
        );
        const nextItem = await getInventoryItemDetails(connection, matchedItem.id);
        balanceAfter = Number(nextItem?.stock || 0);
        await writeLedgerEntry(connection, {
          itemId: matchedItem.id,
          itemName: matchedItem.name,
          referenceType: "waste",
          referenceId: result.insertId,
          direction: "OUT",
          quantity,
          unit: data.unit || matchedItem.unit || null,
          locationName: data.store || nextItem?.branch || null,
          rate: nextItem?.price || 0,
          amount: (nextItem?.price || 0) * quantity,
          balanceAfter,
          remarks: data.reason || data.remarks || null,
          entryDate: data.date || null,
        });
      }

      await commitTransaction(connection);
      return { id: result.insertId, stockUpdated: Boolean(matchedItem && quantity > 0), balanceAfter };
    } catch (error) {
      await rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
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
      `SELECT id, item_id AS itemId, item_name AS itemName, quantity, unit, reason, store, remarks,
              DATE_FORMAT(waste_date, '%Y-%m-%d') AS date, created_by AS createdBy,
              created_at AS createdAt
       FROM inventory_waste_log
       ORDER BY waste_date DESC, created_at DESC`,
      callback,
    );
  },

  updateWasteEntry: async (id, data) => {
    const connection = await getConnection();
    try {
      await beginTransaction(connection);
      const rows = await queryWithConnection(connection, "SELECT * FROM inventory_waste_log WHERE id = ? LIMIT 1", [id]);
      const existing = rows[0];
      if (!existing) {
        const error = new Error("Waste log not found.");
        error.statusCode = 404;
        throw error;
      }

      if (existing.item_id && Number(existing.quantity || 0) > 0) {
        await queryWithConnection(connection, "UPDATE inventory SET stock = stock + ? WHERE id = ?", [
          normalizeNumber(existing.quantity),
          existing.item_id,
        ]);
      }

      const quantity = normalizeNumber(data.quantity);
      const matchedItem = await findInventoryItem(connection, data.itemId || existing.item_id, data.itemName || existing.item_name);

      if (matchedItem && quantity > 0) {
        const currentStock = await getInventoryStock(connection, matchedItem.id);
        if (currentStock < quantity) {
          const error = new Error("Waste quantity current stock se zyada hai.");
          error.statusCode = 400;
          throw error;
        }
      }

      await queryWithConnection(
        connection,
        `
          UPDATE inventory_waste_log
          SET item_id=?, item_name=?, quantity=?, unit=?, reason=?, store=?, remarks=?, waste_date=?
          WHERE id=?
        `,
        [
          matchedItem?.id || data.itemId || existing.item_id || null,
          matchedItem?.name || data.itemName || existing.item_name,
          quantity,
          data.unit || matchedItem?.unit || existing.unit || null,
          data.reason,
          data.store || existing.store || null,
          data.remarks || existing.remarks || null,
          data.date || existing.waste_date || null,
          id,
        ],
      );

      await queryWithConnection(connection, "DELETE FROM inventory_stock_ledger WHERE reference_type = 'waste' AND reference_id = ?", [id]);
      if (matchedItem && quantity > 0) {
        await queryWithConnection(connection, "UPDATE inventory SET stock = stock - ? WHERE id = ?", [quantity, matchedItem.id]);
        const nextItem = await getInventoryItemDetails(connection, matchedItem.id);
        await writeLedgerEntry(connection, {
          itemId: matchedItem.id,
          itemName: matchedItem.name,
          referenceType: "waste",
          referenceId: id,
          direction: "OUT",
          quantity,
          unit: data.unit || matchedItem.unit || null,
          locationName: data.store || nextItem?.branch || null,
          rate: nextItem?.price || 0,
          amount: (nextItem?.price || 0) * quantity,
          balanceAfter: Number(nextItem?.stock || 0),
          remarks: data.reason || data.remarks || null,
          entryDate: data.date || existing.waste_date || null,
        });
      }

      await commitTransaction(connection);
      return { id };
    } catch (error) {
      await rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
  },

  updateWasteLog: (id, data, callback) => {
    const sql = `
      UPDATE inventory_waste_log
      SET item_name=?, quantity=?, unit=?, reason=?, store=?, remarks=?, waste_date=?
      WHERE id=?
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
        id,
      ],
      callback,
    );
  },

  deleteWasteEntry: async (id) => {
    const connection = await getConnection();
    try {
      await beginTransaction(connection);
      const rows = await queryWithConnection(connection, "SELECT * FROM inventory_waste_log WHERE id = ? LIMIT 1", [id]);
      const existing = rows[0];
      if (!existing) {
        const error = new Error("Waste log not found.");
        error.statusCode = 404;
        throw error;
      }

      if (existing.item_id && Number(existing.quantity || 0) > 0) {
        await queryWithConnection(connection, "UPDATE inventory SET stock = stock + ? WHERE id = ?", [
          normalizeNumber(existing.quantity),
          existing.item_id,
        ]);
      }

      await queryWithConnection(connection, "DELETE FROM inventory_waste_log WHERE id = ?", [id]);
      await queryWithConnection(connection, "DELETE FROM inventory_stock_ledger WHERE reference_type = 'waste' AND reference_id = ?", [id]);
      await commitTransaction(connection);
    } catch (error) {
      await rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
  },

  deleteWasteLog: (id, callback) => {
    db.query("DELETE FROM inventory_waste_log WHERE id = ?", [id], callback);
  },

  createPurchaseOrder: (data, callback) => {
    (async () => {
      const sql = `
        INSERT INTO inventory_purchase_orders
          (po_number, vendor, item_name, quantity, unit, rate, expected_date, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = await runQuery(sql, [
        data.poNumber,
        data.vendor,
        data.itemName,
        data.quantity,
        data.unit || null,
        data.rate,
        data.expectedDate || null,
        data.status || "Draft",
        data.createdBy || "system",
      ]);
      await syncAccountsPurchaseOrder(result.insertId, data);
      callback(null, result);
    })().catch((error) => callback(error));
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
    (async () => {
      const existingRows = await runQuery(
        "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS createdDate FROM inventory_purchase_orders WHERE id = ? LIMIT 1",
        [id],
      );
      const sql = `
        UPDATE inventory_purchase_orders
        SET po_number=?, vendor=?, item_name=?, quantity=?, unit=?,
            rate=?, expected_date=?, status=?
        WHERE id=?
      `;
      const result = await runQuery(sql, [
        data.poNumber,
        data.vendor,
        data.itemName,
        data.quantity,
        data.unit || null,
        data.rate,
        data.expectedDate || null,
        data.status,
        id,
      ]);
      await syncAccountsPurchaseOrder(id, data, existingRows[0]?.createdDate || null);
      callback(null, result);
    })().catch((error) => callback(error));
  },

  deletePurchaseOrder: (id, callback) => {
    (async () => {
      const result = await runQuery("DELETE FROM inventory_purchase_orders WHERE id = ?", [id]);
      await deleteAccountsPurchaseOrderMirror(id);
      callback(null, result);
    })().catch((error) => callback(error));
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

  createTransferEntry: async (data) => {
    const connection = await getConnection();
    try {
      await beginTransaction(connection);
      const quantity = normalizeNumber(data.quantity);
      const matchedItem = await findInventoryItem(connection, data.itemId, data.itemName);
      const result = await queryWithConnection(
        connection,
        `
          INSERT INTO inventory_transfers
            (item_id, item_name, from_store, to_store, quantity, unit, approved_by, transfer_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          matchedItem?.id || data.itemId || null,
          matchedItem?.name || data.itemName,
          data.fromStore,
          data.toStore,
          quantity,
          data.unit || matchedItem?.unit || null,
          data.approvedBy || null,
          data.date || null,
          data.notes || null,
        ],
      );

      if (matchedItem && quantity > 0) {
        const currentItem = await getInventoryItemDetails(connection, matchedItem.id);
        await writeLedgerEntry(connection, {
          itemId: matchedItem.id,
          itemName: matchedItem.name,
          referenceType: "transfer_out",
          referenceId: result.insertId,
          direction: "OUT",
          quantity,
          unit: data.unit || matchedItem.unit || null,
          locationName: data.fromStore || null,
          rate: currentItem?.price || 0,
          amount: (currentItem?.price || 0) * quantity,
          balanceAfter: Number(currentItem?.stock || 0),
          remarks: data.notes || null,
          entryDate: data.date || null,
        });
        await writeLedgerEntry(connection, {
          itemId: matchedItem.id,
          itemName: matchedItem.name,
          referenceType: "transfer_in",
          referenceId: result.insertId,
          direction: "IN",
          quantity,
          unit: data.unit || matchedItem.unit || null,
          locationName: data.toStore || null,
          rate: currentItem?.price || 0,
          amount: (currentItem?.price || 0) * quantity,
          balanceAfter: Number(currentItem?.stock || 0),
          remarks: data.notes || null,
          entryDate: data.date || null,
        });
      }

      await commitTransaction(connection);
      return { id: result.insertId };
    } catch (error) {
      await rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
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
      `SELECT id, item_id AS itemId, item_name AS itemName, from_store AS fromStore, to_store AS toStore,
              quantity, unit, approved_by AS approvedBy,
              DATE_FORMAT(transfer_date, '%Y-%m-%d') AS date, notes
       FROM inventory_transfers
       ORDER BY transfer_date DESC, created_at DESC`,
      callback,
    );
  },

  updateTransferEntry: async (id, data) => {
    const connection = await getConnection();
    try {
      await beginTransaction(connection);
      const rows = await queryWithConnection(connection, "SELECT * FROM inventory_transfers WHERE id = ? LIMIT 1", [id]);
      const existing = rows[0];
      if (!existing) {
        const error = new Error("Transfer record not found.");
        error.statusCode = 404;
        throw error;
      }
      const quantity = normalizeNumber(data.quantity);
      const matchedItem = await findInventoryItem(connection, data.itemId || existing.item_id, data.itemName || existing.item_name);

      await queryWithConnection(connection, "DELETE FROM inventory_stock_ledger WHERE reference_id = ? AND reference_type IN ('transfer_out','transfer_in')", [id]);
      await queryWithConnection(
        connection,
        `
          UPDATE inventory_transfers
          SET item_id=?, item_name=?, from_store=?, to_store=?, quantity=?, unit=?, approved_by=?, transfer_date=?, notes=?
          WHERE id=?
        `,
        [
          matchedItem?.id || data.itemId || existing.item_id || null,
          matchedItem?.name || data.itemName || existing.item_name,
          data.fromStore,
          data.toStore,
          quantity,
          data.unit || matchedItem?.unit || existing.unit || null,
          data.approvedBy || null,
          data.date || null,
          data.notes || null,
          id,
        ],
      );

      if (matchedItem && quantity > 0) {
        const currentItem = await getInventoryItemDetails(connection, matchedItem.id);
        await writeLedgerEntry(connection, {
          itemId: matchedItem.id,
          itemName: matchedItem.name,
          referenceType: "transfer_out",
          referenceId: id,
          direction: "OUT",
          quantity,
          unit: data.unit || matchedItem.unit || null,
          locationName: data.fromStore || null,
          rate: currentItem?.price || 0,
          amount: (currentItem?.price || 0) * quantity,
          balanceAfter: Number(currentItem?.stock || 0),
          remarks: data.notes || null,
          entryDate: data.date || null,
        });
        await writeLedgerEntry(connection, {
          itemId: matchedItem.id,
          itemName: matchedItem.name,
          referenceType: "transfer_in",
          referenceId: id,
          direction: "IN",
          quantity,
          unit: data.unit || matchedItem.unit || null,
          locationName: data.toStore || null,
          rate: currentItem?.price || 0,
          amount: (currentItem?.price || 0) * quantity,
          balanceAfter: Number(currentItem?.stock || 0),
          remarks: data.notes || null,
          entryDate: data.date || null,
        });
      }
      await commitTransaction(connection);
      return { id };
    } catch (error) {
      await rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
  },

  updateTransfer: (id, data, callback) => {
    const sql = `
      UPDATE inventory_transfers
      SET item_name=?, from_store=?, to_store=?, quantity=?, unit=?, approved_by=?, transfer_date=?, notes=?
      WHERE id=?
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
        id,
      ],
      callback,
    );
  },

  deleteTransferEntry: async (id) => {
    const connection = await getConnection();
    try {
      await beginTransaction(connection);
      const rows = await queryWithConnection(connection, "SELECT id FROM inventory_transfers WHERE id = ? LIMIT 1", [id]);
      if (!rows[0]) {
        const error = new Error("Transfer record not found.");
        error.statusCode = 404;
        throw error;
      }
      await queryWithConnection(connection, "DELETE FROM inventory_transfers WHERE id = ?", [id]);
      await queryWithConnection(connection, "DELETE FROM inventory_stock_ledger WHERE reference_id = ? AND reference_type IN ('transfer_out','transfer_in')", [id]);
      await commitTransaction(connection);
    } catch (error) {
      await rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
  },

  deleteTransfer: (id, callback) => {
    db.query("DELETE FROM inventory_transfers WHERE id = ?", [id], callback);
  },

  createVendorInward: async (data) => {
    const connection = await getConnection();
    try {
      await beginTransaction(connection);

      const quantityReceived = normalizeNumber(data.quantityReceived);
      const rate = normalizeNumber(data.rate);
      const amount = normalizeNumber(
        data.amount,
        quantityReceived > 0 && rate > 0 ? quantityReceived * rate : 0,
      );
      const matchedItem = await findInventoryItem(connection, data.itemId, data.itemName);
      const stockUpdated = matchedItem && quantityReceived > 0 ? 1 : 0;

      const inwardResult = await queryWithConnection(
        connection,
        `
          INSERT INTO inventory_vendor_inwards
            (po_id, po_number, vendor_name, item_id, item_name, quantity_received, unit, rate, amount, invoice_no, batch_no, expiry_date, received_date, store, remarks, stock_updated, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          data.poId || null,
          data.poNumber || null,
          data.vendorName || data.vendor || "",
          matchedItem?.id || data.itemId || null,
          matchedItem?.name || data.itemName || "",
          quantityReceived,
          data.unit || matchedItem?.unit || null,
          rate,
          amount,
          data.invoiceNo || null,
          data.batchNo || null,
          data.expiryDate || null,
          data.receivedDate || null,
          data.store || null,
          data.remarks || null,
          stockUpdated,
          data.createdBy || "system",
        ],
      );

      let balanceAfter = null;
      if (stockUpdated) {
        await queryWithConnection(
          connection,
          "UPDATE inventory SET stock = stock + ? WHERE id = ?",
          [quantityReceived, matchedItem.id],
        );
        await syncInventoryExpiryFromInwards(connection, matchedItem.id);
        balanceAfter = await getInventoryStock(connection, matchedItem.id);
      }

      await writeLedgerEntry(connection, {
        itemId: matchedItem?.id || data.itemId || null,
        itemName: matchedItem?.name || data.itemName,
        referenceType: "vendor_inward",
        referenceId: inwardResult.insertId,
        direction: "IN",
        quantity: quantityReceived,
        unit: data.unit || matchedItem?.unit || null,
        vendorName: data.vendorName || data.vendor || "",
        locationName: data.store || null,
        rate,
        amount,
        balanceAfter,
        remarks: data.remarks || data.invoiceNo || null,
        entryDate: data.receivedDate || null,
      });

      if (data.poId || data.poNumber) {
        await queryWithConnection(
          connection,
          `
            UPDATE inventory_purchase_orders
            SET status = 'GRN Received'
            WHERE ${data.poId ? "id = ?" : "po_number = ?"}
          `,
          [data.poId || data.poNumber],
        );
      }

      await commitTransaction(connection);
      return { id: inwardResult.insertId, stockUpdated: Boolean(stockUpdated) };
    } catch (error) {
      await rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
  },

  getVendorInwards: (callback) => {
    db.query(
      `SELECT id,
              po_id AS poId,
              po_number AS poNumber,
              vendor_name AS vendorName,
              item_id AS itemId,
              item_name AS itemName,
              quantity_received AS quantityReceived,
              unit,
              rate,
              amount,
              invoice_no AS invoiceNo,
              batch_no AS batchNo,
              DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiryDate,
              DATE_FORMAT(received_date, '%Y-%m-%d') AS receivedDate,
              store,
              remarks,
              stock_updated AS stockUpdated,
              created_by AS createdBy,
              created_at AS createdAt
       FROM inventory_vendor_inwards
       ORDER BY received_date DESC, created_at DESC`,
      callback,
    );
  },

  updateVendorInward: async (id, data) => {
    const connection = await getConnection();
    try {
      await beginTransaction(connection);

      const existingRows = await queryWithConnection(
        connection,
        "SELECT * FROM inventory_vendor_inwards WHERE id = ? LIMIT 1",
        [id],
      );
      const existing = existingRows[0];
      if (!existing) {
        const error = new Error("Vendor inward not found.");
        error.statusCode = 404;
        throw error;
      }

      if (Number(existing.stock_updated || 0) && existing.item_id) {
        await queryWithConnection(
          connection,
          "UPDATE inventory SET stock = stock - ? WHERE id = ?",
          [normalizeNumber(existing.quantity_received), existing.item_id],
        );
      }

      const quantityReceived = normalizeNumber(data.quantityReceived);
      const rate = normalizeNumber(data.rate);
      const amount = normalizeNumber(
        data.amount,
        quantityReceived > 0 && rate > 0 ? quantityReceived * rate : 0,
      );
      const matchedItem = await findInventoryItem(
        connection,
        data.itemId || existing.item_id,
        data.itemName || existing.item_name,
      );
      const stockUpdated = matchedItem && quantityReceived > 0 ? 1 : 0;

      let balanceAfter = null;
      if (stockUpdated) {
        await queryWithConnection(
          connection,
          "UPDATE inventory SET stock = stock + ? WHERE id = ?",
          [quantityReceived, matchedItem.id],
        );
        await syncInventoryExpiryFromInwards(connection, matchedItem.id);
        balanceAfter = await getInventoryStock(connection, matchedItem.id);
      }

      await queryWithConnection(
        connection,
        `
          UPDATE inventory_vendor_inwards
          SET po_id=?, po_number=?, vendor_name=?, item_id=?, item_name=?, quantity_received=?, unit=?, rate=?, amount=?, invoice_no=?, batch_no=?, expiry_date=?, received_date=?, store=?, remarks=?, stock_updated=?, created_by=?
          WHERE id=?
        `,
        [
          data.poId || existing.po_id || null,
          data.poNumber || existing.po_number || null,
          data.vendorName || data.vendor || existing.vendor_name,
          matchedItem?.id || data.itemId || existing.item_id || null,
          matchedItem?.name || data.itemName || existing.item_name,
          quantityReceived,
          data.unit || matchedItem?.unit || existing.unit || null,
          rate,
          amount,
          data.invoiceNo || existing.invoice_no || null,
          data.batchNo || existing.batch_no || null,
          data.expiryDate || existing.expiry_date || null,
          data.receivedDate || existing.received_date || null,
          data.store || existing.store || null,
          data.remarks || existing.remarks || null,
          stockUpdated,
          data.createdBy || existing.created_by || "system",
          id,
        ],
      );

      await queryWithConnection(
        connection,
        "DELETE FROM inventory_stock_ledger WHERE reference_type = 'vendor_inward' AND reference_id = ?",
        [id],
      );
      await writeLedgerEntry(connection, {
        itemId: matchedItem?.id || data.itemId || existing.item_id || null,
        itemName: matchedItem?.name || data.itemName || existing.item_name,
        referenceType: "vendor_inward",
        referenceId: id,
        direction: "IN",
        quantity: quantityReceived,
        unit: data.unit || matchedItem?.unit || existing.unit || null,
        vendorName: data.vendorName || data.vendor || existing.vendor_name,
        locationName: data.store || existing.store || null,
        rate,
        amount,
        balanceAfter,
        remarks: data.remarks || data.invoiceNo || existing.invoice_no || null,
        entryDate: data.receivedDate || existing.received_date || null,
      });

      if (existing.item_id) {
        await syncInventoryExpiryFromInwards(connection, existing.item_id);
      }
      if (matchedItem?.id && matchedItem.id !== existing.item_id) {
        await syncInventoryExpiryFromInwards(connection, matchedItem.id);
      }

      await commitTransaction(connection);
      return { stockUpdated: Boolean(stockUpdated) };
    } catch (error) {
      await rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
  },

  deleteVendorInward: async (id) => {
    const connection = await getConnection();
    try {
      await beginTransaction(connection);
      const rows = await queryWithConnection(
        connection,
        "SELECT * FROM inventory_vendor_inwards WHERE id = ? LIMIT 1",
        [id],
      );
      const existing = rows[0];
      if (!existing) {
        const error = new Error("Vendor inward not found.");
        error.statusCode = 404;
        throw error;
      }

      if (Number(existing.stock_updated || 0) && existing.item_id) {
        await queryWithConnection(
          connection,
          "UPDATE inventory SET stock = stock - ? WHERE id = ?",
          [normalizeNumber(existing.quantity_received), existing.item_id],
        );
        await syncInventoryExpiryFromInwards(connection, existing.item_id);
      }

      await queryWithConnection(connection, "DELETE FROM inventory_vendor_inwards WHERE id = ?", [id]);
      await queryWithConnection(
        connection,
        "DELETE FROM inventory_stock_ledger WHERE reference_type = 'vendor_inward' AND reference_id = ?",
        [id],
      );
      await commitTransaction(connection);
    } catch (error) {
      await rollbackTransaction(connection);
      throw error;
    } finally {
      connection.release();
    }
  },

  createVendorPayment: (data, callback) => {
    (async () => {
      const sql = `
        INSERT INTO inventory_vendor_payments
          (vendor_name, invoice_ref, payment_date, amount, payment_mode, status, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = await runQuery(sql, [
        data.vendorName || data.vendor || "",
        data.invoiceRef || null,
        data.paymentDate || null,
        normalizeNumber(data.amount),
        data.paymentMode || "Bank Transfer",
        data.status || "Scheduled",
        data.notes || null,
        data.createdBy || "system",
      ]);
      await syncAccountsVendorPayment(result.insertId, data);
      callback(null, result);
    })().catch((error) => callback(error));
  },

  getVendorPayments: (callback) => {
    db.query(
      `SELECT id,
              vendor_name AS vendorName,
              invoice_ref AS invoiceRef,
              DATE_FORMAT(payment_date, '%Y-%m-%d') AS paymentDate,
              amount,
              payment_mode AS paymentMode,
              status,
              notes,
              created_by AS createdBy,
              created_at AS createdAt
       FROM inventory_vendor_payments
       ORDER BY payment_date DESC, created_at DESC`,
      callback,
    );
  },

  updateVendorPayment: (id, data, callback) => {
    (async () => {
      const sql = `
        UPDATE inventory_vendor_payments
        SET vendor_name=?, invoice_ref=?, payment_date=?, amount=?, payment_mode=?, status=?, notes=?
        WHERE id=?
      `;
      const result = await runQuery(sql, [
        data.vendorName || data.vendor || "",
        data.invoiceRef || null,
        data.paymentDate || null,
        normalizeNumber(data.amount),
        data.paymentMode || "Bank Transfer",
        data.status || "Scheduled",
        data.notes || null,
        id,
      ]);
      await syncAccountsVendorPayment(id, data);
      callback(null, result);
    })().catch((error) => callback(error));
  },

  deleteVendorPayment: (id, callback) => {
    (async () => {
      const result = await runQuery("DELETE FROM inventory_vendor_payments WHERE id = ?", [id]);
      await deleteAccountsVendorPaymentMirror(id);
      callback(null, result);
    })().catch((error) => callback(error));
  },

  getStockLedger: (callback) => {
    db.query(
      `SELECT *
       FROM (
         SELECT
           l.id,
           l.item_id AS itemId,
           l.item_name AS itemName,
           l.reference_type AS referenceType,
           l.reference_id AS referenceId,
           l.direction,
           l.quantity,
           l.unit,
           l.vendor_name AS vendorName,
           l.location_name AS locationName,
           l.rate,
           l.amount,
           l.balance_after AS balanceAfter,
           l.remarks,
           DATE_FORMAT(l.entry_date, '%Y-%m-%d') AS entryDate,
           l.created_at AS createdAt
         FROM inventory_stock_ledger l
         UNION ALL
         SELECT
           icl.id,
           icl.inventory_item_id AS itemId,
           icl.inventoryItemName AS itemName,
           'consumption' AS referenceType,
           icl.reference_id AS referenceId,
           'OUT' AS direction,
           icl.consumed_quantity AS quantity,
           icl.unit,
           NULL AS vendorName,
           NULL AS locationName,
           0 AS rate,
           0 AS amount,
           NULL AS balanceAfter,
           icl.remarks,
           DATE_FORMAT(icl.consumed_at, '%Y-%m-%d') AS entryDate,
           icl.consumed_at AS createdAt
         FROM (
           SELECT
             c.id,
             c.reference_id,
             c.inventory_item_id,
             i.name AS inventoryItemName,
             c.consumed_quantity,
             c.unit,
             c.remarks,
             c.consumed_at
           FROM inventory_consumption_log c
           INNER JOIN inventory i ON i.id = c.inventory_item_id
         ) icl
       ) ledger
       ORDER BY entryDate DESC, createdAt DESC`,
      callback,
    );
  },

  getVendorInsights: async () => {
    const [summaryRows, vendorRows] = await Promise.all([
      runQuery(
        `
          SELECT
            (SELECT COUNT(*) FROM inventory_vendors) AS totalVendors,
            (SELECT COALESCE(SUM(quantity_received), 0) FROM inventory_vendor_inwards) AS totalReceivedQty,
            (SELECT COALESCE(SUM(amount), 0) FROM inventory_vendor_inwards) AS totalReceivedValue,
            (SELECT COALESCE(SUM(amount), 0) FROM inventory_vendor_payments WHERE status <> 'Cancelled') AS totalPaidAmount
        `,
      ),
      runQuery(
        `
          SELECT
            base.vendorName,
            COALESCE(v.status, 'Active') AS status,
            COALESCE(inwardStats.receiptsCount, 0) AS receiptsCount,
            COALESCE(inwardStats.totalQty, 0) AS totalQty,
            COALESCE(inwardStats.totalValue, 0) AS totalValue,
            COALESCE(paymentStats.totalPaid, 0) AS totalPaid,
            COALESCE(paymentStats.paymentCount, 0) AS paymentCount,
            inwardStats.lastReceivedDate AS lastReceivedDate
          FROM (
            SELECT name AS vendorName FROM inventory_vendors
            UNION
            SELECT vendor_name AS vendorName FROM inventory_vendor_inwards
            UNION
            SELECT vendor_name AS vendorName FROM inventory_vendor_payments
          ) base
          LEFT JOIN inventory_vendors v
            ON LOWER(v.name) = LOWER(base.vendorName)
          LEFT JOIN (
            SELECT
              vendor_name,
              COUNT(*) AS receiptsCount,
              COALESCE(SUM(quantity_received), 0) AS totalQty,
              COALESCE(SUM(amount), 0) AS totalValue,
              MAX(DATE_FORMAT(received_date, '%Y-%m-%d')) AS lastReceivedDate
            FROM inventory_vendor_inwards
            GROUP BY vendor_name
          ) inwardStats
            ON LOWER(inwardStats.vendor_name) = LOWER(base.vendorName)
          LEFT JOIN (
            SELECT
              vendor_name,
              COUNT(*) AS paymentCount,
              COALESCE(SUM(amount), 0) AS totalPaid
            FROM inventory_vendor_payments
            WHERE status <> 'Cancelled'
            GROUP BY vendor_name
          ) paymentStats
            ON LOWER(paymentStats.vendor_name) = LOWER(base.vendorName)
          WHERE base.vendorName IS NOT NULL AND base.vendorName <> ''
          ORDER BY totalValue DESC, totalQty DESC, base.vendorName ASC
        `,
      ),
    ]);

    const summary = summaryRows?.[0] || {};
    const vendors = (vendorRows || []).map((row) => ({
      ...row,
      totalDue: Math.max(Number(row.totalValue || 0) - Number(row.totalPaid || 0), 0),
    }));

    return {
      summary: {
        totalVendors: Number(summary.totalVendors || 0),
        totalReceivedQty: Number(summary.totalReceivedQty || 0),
        totalReceivedValue: Number(summary.totalReceivedValue || 0),
        totalPaidAmount: Number(summary.totalPaidAmount || 0),
        totalOutstandingAmount: vendors.reduce((sum, row) => sum + Number(row.totalDue || 0), 0),
      },
      vendors,
    };
  },

  getStockFlowReport: async (options = {}) => {
    const dateFrom = normalizeDateOnly(options.dateFrom);
    const dateTo = normalizeDateOnly(options.dateTo);

    const [inventoryRows, vendorRows, ledgerRows] = await Promise.all([
      runQuery(
        `SELECT id, name, category, stock, unit, price,
                reorder_point AS reorderPoint,
                branch
         FROM inventory
         ORDER BY name ASC`,
      ),
      runQuery(
        `SELECT item_id AS itemId, item_name AS itemName, vendor_name AS vendorName,
                DATE_FORMAT(received_date, '%Y-%m-%d') AS receivedDate,
                created_at AS createdAt
         FROM inventory_vendor_inwards
         ORDER BY received_date DESC, created_at DESC`,
      ),
      runQuery(
        `SELECT *
         FROM (
           SELECT
             l.item_id AS itemId,
             l.item_name AS itemName,
             l.reference_type AS referenceType,
             l.direction,
             l.quantity,
             l.unit,
             l.balance_after AS balanceAfter,
             DATE_FORMAT(l.entry_date, '%Y-%m-%d') AS entryDate,
             l.created_at AS createdAt
           FROM inventory_stock_ledger l
           UNION ALL
           SELECT
             c.inventory_item_id AS itemId,
             i.name AS itemName,
             'consumption' AS referenceType,
             'OUT' AS direction,
             c.consumed_quantity AS quantity,
             c.unit,
             NULL AS balanceAfter,
             DATE_FORMAT(c.consumed_at, '%Y-%m-%d') AS entryDate,
             c.consumed_at AS createdAt
           FROM inventory_consumption_log c
           INNER JOIN inventory i ON i.id = c.inventory_item_id
         ) ledger
         ORDER BY entryDate ASC, createdAt ASC`,
      ),
    ]);

    const latestVendorByItem = new Map();
    (vendorRows || []).forEach((row) => {
      const itemKey = String(row.itemId || "").trim() || String(row.itemName || "").trim().toLowerCase();
      if (!itemKey || latestVendorByItem.has(itemKey)) return;
      latestVendorByItem.set(itemKey, row.vendorName || null);
    });

    const ledgerByItem = new Map();
    (ledgerRows || []).forEach((row) => {
      const itemKey = String(row.itemId || "").trim() || String(row.itemName || "").trim().toLowerCase();
      if (!itemKey) return;
      const current = ledgerByItem.get(itemKey) || [];
      current.push({
        referenceType: String(row.referenceType || "").toLowerCase(),
        direction: String(row.direction || "").toUpperCase(),
        quantity: normalizeNumber(row.quantity),
        entryDate: normalizeDateOnly(row.entryDate),
      });
      ledgerByItem.set(itemKey, current);
    });

    const rows = (inventoryRows || []).map((item) => {
      const itemKey = String(item.id || "").trim() || String(item.name || "").trim().toLowerCase();
      const itemLedger = ledgerByItem.get(itemKey) || [];
      const currentStock = normalizeNumber(item.stock);
      const unitRate = normalizeNumber(item.price);
      const signedTotal = itemLedger.reduce((sum, entry) => (
        sum + (entry.direction === "OUT" ? -entry.quantity : entry.quantity)
      ), 0);
      const baselineOpening = currentStock - signedTotal;

      let openingQty = baselineOpening;
      let receivedQty = 0;
      let usedQty = 0;

      itemLedger.forEach((entry) => {
        const entryDate = entry.entryDate;
        const isOpeningEntry = entry.referenceType === "opening_balance";
        const isBeforeStart = Boolean(dateFrom && entryDate && entryDate < dateFrom);
        const isOnOrBeforeStart = Boolean(dateFrom && entryDate && entryDate <= dateFrom);
        const isAfterEnd = Boolean(dateTo && entryDate && entryDate > dateTo);
        const isInPeriod =
          (!dateFrom || !entryDate || entryDate >= dateFrom) &&
          (!dateTo || !entryDate || entryDate <= dateTo);

        if (!dateFrom) {
          if (isOpeningEntry) {
            openingQty += entry.quantity;
            return;
          }
        } else if (isOpeningEntry ? isOnOrBeforeStart : isBeforeStart) {
          openingQty += entry.direction === "OUT" ? -entry.quantity : entry.quantity;
          return;
        } else if (!isOpeningEntry && isBeforeStart) {
          openingQty += entry.direction === "OUT" ? -entry.quantity : entry.quantity;
          return;
        }

        if (isAfterEnd || !isInPeriod) {
          return;
        }

        if (isOpeningEntry) {
          receivedQty += entry.quantity;
          return;
        }

        if (entry.direction === "OUT") {
          usedQty += entry.quantity;
        } else {
          receivedQty += entry.quantity;
        }
      });

      const remainingQty = openingQty + receivedQty - usedQty;
      const vendorKey = String(item.id || "").trim() || String(item.name || "").trim().toLowerCase();

      return {
        itemId: item.id,
        item: item.name,
        category: item.category || "",
        vendor: latestVendorByItem.get(vendorKey) || null,
        openingQty: Number(openingQty.toFixed(2)),
        receivedQty: Number(receivedQty.toFixed(2)),
        usedQty: Number(usedQty.toFixed(2)),
        remainingQty: Number(remainingQty.toFixed(2)),
        unit: item.unit || "",
        unitRate,
        amount: Number((remainingQty * unitRate).toFixed(2)),
        reorderPoint: normalizeNumber(item.reorderPoint, 10),
        store: item.branch || "",
        alert: remainingQty <= normalizeNumber(item.reorderPoint, 10) ? "Low" : "OK",
      };
    });

    const summary = rows.reduce((accumulator, row) => ({
      opening: accumulator.opening + row.openingQty,
      received: accumulator.received + row.receivedQty,
      used: accumulator.used + row.usedQty,
      remaining: accumulator.remaining + row.remainingQty,
      amount: accumulator.amount + row.amount,
    }), {
      opening: 0,
      received: 0,
      used: 0,
      remaining: 0,
      amount: 0,
    });

    return {
      filters: { dateFrom, dateTo },
      summary: {
        opening: Number(summary.opening.toFixed(2)),
        received: Number(summary.received.toFixed(2)),
        used: Number(summary.used.toFixed(2)),
        remaining: Number(summary.remaining.toFixed(2)),
        amount: Number(summary.amount.toFixed(2)),
      },
      rows,
    };
  },
};

module.exports = Inventory;
