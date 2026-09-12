const db = require("../config/db");


const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });

const getSummary = async (req, res) => {
  const { from, to, type, department, status } = req.query;

  let sql = `
    SELECT
      id,
      date,
      type,
      department,
      source_module,
      description,
      amount,
      payment_mode,
      CASE WHEN payment_mode = 'UPI' THEN 'Digital' ELSE 'Manual' END AS payment_method
    FROM accounts_transactions
    WHERE 1 = 1
  `;

  const params = [];

  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }
  if (department) {
    sql += " AND department = ?";
    params.push(department);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY date DESC";

  try {
    const results = await query(sql, params);

    const totals = results.reduce(
      (acc, row) => {
        const amount = Number(row.amount || 0);
        if (row.type === "Income") {
          acc.income += amount;
        } else if (row.type === "Expense") {
          acc.expense += amount;
        }
        return acc;
      },
      { income: 0, expense: 0 },
    );

    totals.balance = totals.income - totals.expense;

    res.json({
      transactions: results,
      summary: totals,
      totalRecords: results.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch summary", error: error.message });
  }
};

const getTransactions = async (req, res) => {
  const { from, to, type, department, search, page = 1, limit = 25 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `
    SELECT
      id,
      date,
      type,
      department,
      source_module,
      description,
      amount,
      payment_mode,
      CASE WHEN payment_mode = 'UPI' THEN 'Digital' ELSE 'Manual' END AS payment_method
    FROM accounts_transactions
    WHERE 1 = 1
  `;

  const params = [];
  const countParams = [];

  if (from) {
    sql += " AND date >= ?";
    params.push(from);
    countParams.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
    countParams.push(to);
  }
  if (type) {
    sql += " AND type = ?";
    params.push(type);
    countParams.push(type);
  }
  if (department) {
    sql += " AND department = ?";
    params.push(department);
    countParams.push(department);
  }
  if (search) {
    sql += " AND (description LIKE ? OR source_module LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
    countParams.push(`%${search}%`, `%${search}%`);
  }

  const countSql = sql.replace(/SELECT[\s\S]*FROM/, "SELECT COUNT(*) AS total FROM");
  const dataSql = `${sql} ORDER BY date DESC LIMIT ? OFFSET ?`;

  try {
    const [countResult, transactions] = await Promise.all([
      query(countSql, countParams),
      query(dataSql, [...params, Number(limit), offset]),
    ]);

    const totals = transactions.reduce(
      (acc, row) => {
        const amount = Number(row.amount || 0);
        if (row.type === "Income") {
          acc.income += amount;
        } else if (row.type === "Expense") {
          acc.expense += amount;
        }
        return acc;
      },
      { income: 0, expense: 0 },
    );

    totals.balance = totals.income - totals.expense;

    res.json({
      transactions,
      summary: totals,
      totalRecords: countResult[0]?.total || 0,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transactions", error: error.message });
  }
};

const createTransaction = async (req, res) => {
  const { date, type, department, source_module, description, amount, payment_mode } = req.body;

  try {
    const result = await query(
      `INSERT INTO accounts_transactions (date, type, department, source_module, description, amount, payment_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [date || new Date().toISOString().slice(0, 10), type, department, source_module, description, amount, payment_mode],
    );

    res.status(201).json({ message: "Transaction created", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to create transaction", error: error.message });
  }
};

const getTransactionById = async (req, res) => {
  try {
    const results = await query("SELECT * FROM accounts_transactions WHERE id = ?", [req.params.id]);
    res.json(results[0] || null);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transaction", error: error.message });
  }
};

const updateTransaction = async (req, res) => {
  const { date, type, department, source_module, description, amount, payment_mode } = req.body;

  try {
    await query(
      `UPDATE accounts_transactions
       SET date = ?, type = ?, department = ?, source_module = ?, description = ?, amount = ?, payment_mode = ?
       WHERE id = ?`,
      [date, type, department, source_module, description, amount, payment_mode, req.params.id],
    );

    res.json({ message: "Transaction updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update transaction", error: error.message });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    await query("DELETE FROM accounts_transactions WHERE id = ?", [req.params.id]);
    res.json({ message: "Transaction deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete transaction", error: error.message });
  }
};

const getDepartmentSummary = async (req, res) => {
  const { from, to } = req.query;

  let sql = `
    SELECT
      department,
      type,
      SUM(amount) AS total_amount,
      COUNT(*) AS transaction_count
    FROM accounts_transactions
    WHERE 1 = 1
  `;

  const params = [];

  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }

  sql += " GROUP BY department, type ORDER BY department, type";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch department summary", error: error.message });
  }
};

const getHotelBillingRecords = async (req, res) => {
  const { from, to, status } = req.query;

  let sql = `
    SELECT
      g.id AS booking_id,
      g.booking_code,
      g.guest_name,
      DATE_FORMAT(g.check_in, '%Y-%m-%d') AS check_in,
      DATE_FORMAT(g.check_out, '%Y-%m-%d') AS check_out,
      COALESCE(SUM(rt.tariff * rt.quantity), 0) AS total_amount,
      IFNULL(a.amount, 0) AS paid_amount,
      IFNULL(a.discount_amount, 0) AS discount_amount,
      (
        COALESCE(SUM(rt.tariff * rt.quantity), 0) -
        (IFNULL(a.amount, 0) + IFNULL(a.discount_amount, 0))
      ) AS remaining_amount
    FROM guests g
    LEFT JOIN room_tariff rt ON g.id = rt.booking_id
    LEFT JOIN advance_payment a ON g.id = a.booking_id
    WHERE 1 = 1
  `;

  const params = [];

  if (from) {
    sql += " AND g.check_in >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND g.check_out <= ?";
    params.push(to);
  }
  if (status) {
    sql += " AND g.booking_status = ?";
    params.push(status);
  }

  sql += " GROUP BY g.id, g.booking_code, g.guest_name, g.check_in, g.check_out, a.amount, a.discount_amount ORDER BY g.id DESC";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch hotel billing records", error: error.message });
  }
};

const getRestaurantBillingRecords = async (req, res) => {
  const { from, to, status } = req.query;

  let sql = `
    SELECT
      b.id,
      b.invoice_no,
      b.room_number,
      b.total_amount,
      b.discount_amount,
      b.gst_amount,
      b.grand_total,
      b.paid_amount,
      b.payment_mode,
      b.payment_status,
      b.bill_type,
      DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS bill_date
    FROM bills b
    WHERE LOWER(IFNULL(b.source_module, '')) = 'restaurant' OR LOWER(IFNULL(b.bill_type, '')) = 'restaurant'
  `;

  const params = [];

  if (from) {
    sql += " AND DATE(b.bill_date) >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND DATE(b.bill_date) <= ?";
    params.push(to);
  }
  if (status) {
    sql += " AND b.payment_status = ?";
    params.push(status);
  }

  sql += " ORDER BY b.bill_date DESC, b.id DESC";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch restaurant billing records", error: error.message });
  }
};

const getAllPaymentHistory = async (req, res) => {
  const { from, to, module, payment_mode } = req.query;

  let sql = `
    SELECT
      ph.id,
      ph.booking_id,
      ph.amount,
      IFNULL(ph.discount_amount, 0) AS discount_amount,
      ph.payment_mode,
      ph.description,
      DATE_FORMAT(ph.created_at, '%Y-%m-%d') AS date,
      g.guest_name,
      b.invoice_no
    FROM payment_history ph
    LEFT JOIN guests g ON ph.booking_id = g.id
    LEFT JOIN bills b ON ph.bill_id = b.id
    WHERE 1 = 1
  `;

  const params = [];

  if (from) {
    sql += " AND DATE(ph.created_at) >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND DATE(ph.created_at) <= ?";
    params.push(to);
  }
  if (module) {
    sql += " AND ph.source_module = ?";
    params.push(module);
  }
  if (payment_mode) {
    sql += " AND ph.payment_mode = ?";
    params.push(payment_mode);
  }

  sql += " ORDER BY ph.created_at DESC, ph.id DESC";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payment history", error: error.message });
  }
};

const savePaymentHistory = async (req, res) => {
  const { booking_id, bill_id, amount, discount_amount, payment_mode, description } = req.body;

  try {
    const result = await query(
      `INSERT INTO payment_history
        (booking_id, bill_id, amount, discount_amount, payment_mode, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [booking_id || null, bill_id || null, amount, discount_amount || 0, payment_mode, description || null],
    );

    res.status(201).json({ message: "Payment history saved", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to save payment history", error: error.message });
  }
};

const getExtendedSummary = async (req, res) => {
  try {
    const { from, to } = req.query;

    let sql = `
      SELECT
        at.type,
        at.department,
        at.payment_mode,
        SUM(at.amount) AS total_amount,
        COUNT(*) AS count
      FROM accounts_transactions at
      WHERE 1 = 1
    `;

    const params = [];
    if (from) {
      sql += " AND at.date >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND at.date <= ?";
      params.push(to);
    }

    sql += " GROUP BY at.type, at.department, at.payment_mode ORDER BY at.type, at.department";

    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch extended summary", error: error.message });
  }
};

const getReconciliationSummary = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        bl.source,
        bl.status,
        COUNT(*) AS count,
        SUM(bl.amount) AS total_amount
      FROM bank_ledger bl
      GROUP BY bl.source, bl.status
      ORDER BY bl.source, bl.status
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reconciliation summary", error: error.message });
  }
};

const listReconciliationItems = async (req, res) => {
  const { status, from, to } = req.query;

  let sql = "SELECT * FROM bank_ledger WHERE 1 = 1";
  const params = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }

  sql += " ORDER BY date DESC, id DESC";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reconciliation items", error: error.message });
  }
};

const matchBankLedger = async (req, res) => {
  const { id } = req.params;

  try {
    await query("UPDATE bank_ledger SET status = 'Matched' WHERE id = ?", [id]);
    res.json({ message: "Bank ledger item matched" });
  } catch (error) {
    res.status(500).json({ message: "Failed to match bank ledger item", error: error.message });
  }
};

const unmatchBankLedger = async (req, res) => {
  const { id } = req.params;

  try {
    await query("UPDATE bank_ledger SET status = 'Unmatched' WHERE id = ?", [id]);
    res.json({ message: "Bank ledger item unmatched" });
  } catch (error) {
    res.status(500).json({ message: "Failed to unmatch bank ledger item", error: error.message });
  }
};

const listBankLedger = async (req, res) => {
  const { from, to, status } = req.query;

  let sql = "SELECT * FROM bank_ledger WHERE 1 = 1";
  const params = [];

  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY date DESC, id DESC";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bank ledger", error: error.message });
  }
};

const addBankLedger = async (req, res) => {
  const { date, amount, reference_no, description, source, status } = req.body;

  try {
    const result = await query(
      `INSERT INTO bank_ledger (date, amount, reference_no, description, source, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [date || new Date().toISOString().slice(0, 10), amount, reference_no, description, source, status || "Unmatched"],
    );
    res.status(201).json({ message: "Bank ledger entry added", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add bank ledger entry", error: error.message });
  }
};

const updateBankLedger = async (req, res) => {
  const { date, amount, reference_no, description, source, status } = req.body;

  try {
    await query(
      `UPDATE bank_ledger
       SET date = ?, amount = ?, reference_no = ?, description = ?, source = ?, status = ?
       WHERE id = ?`,
      [date, amount, reference_no, description, source, status, req.params.id],
    );
    res.json({ message: "Bank ledger entry updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update bank ledger entry", error: error.message });
  }
};

const deleteBankLedger = async (req, res) => {
  try {
    await query("DELETE FROM bank_ledger WHERE id = ?", [req.params.id]);
    res.json({ message: "Bank ledger entry deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete bank ledger entry", error: error.message });
  }
};

const listPettyCash = async (req, res) => {
  const { from, to } = req.query;

  let sql = "SELECT * FROM petty_cash WHERE 1 = 1";
  const params = [];

  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }

  sql += " ORDER BY date DESC, id DESC";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch petty cash", error: error.message });
  }
};

const addPettyCash = async (req, res) => {
  const { date, amount, description, category } = req.body;

  try {
    const result = await query(
      `INSERT INTO petty_cash (date, amount, description, category)
       VALUES (?, ?, ?, ?)`,
      [date || new Date().toISOString().slice(0, 10), amount, description, category || "General"],
    );
    res.status(201).json({ message: "Petty cash entry added", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add petty cash entry", error: error.message });
  }
};

const updatePettyCash = async (req, res) => {
  const { date, amount, description, category } = req.body;

  try {
    await query(
      `UPDATE petty_cash
       SET date = ?, amount = ?, description = ?, category = ?
       WHERE id = ?`,
      [date, amount, description, category, req.params.id],
    );
    res.json({ message: "Petty cash entry updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update petty cash entry", error: error.message });
  }
};

const deletePettyCash = async (req, res) => {
  try {
    await query("DELETE FROM petty_cash WHERE id = ?", [req.params.id]);
    res.json({ message: "Petty cash entry deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete petty cash entry", error: error.message });
  }
};

const listGstReturns = async (req, res) => {
  const { from, to } = req.query;

  let sql = "SELECT * FROM gst_returns WHERE 1 = 1";
  const params = [];

  if (from) {
    sql += " AND period >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND period <= ?";
    params.push(to);
  }

  sql += " ORDER BY period DESC, id DESC";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch GST returns", error: error.message });
  }
};

const addGstReturn = async (req, res) => {
  const { period, gst_type, total_taxable_value, total_cgst, total_sgst, total_igst, total_tax, status } = req.body;

  try {
    const result = await query(
      `INSERT INTO gst_returns (period, gst_type, total_taxable_value, total_cgst, total_sgst, total_igst, total_tax, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [period, gst_type, total_taxable_value, total_cgst, total_sgst, total_igst, total_tax, status || "Pending"],
    );
    res.status(201).json({ message: "GST return added", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add GST return", error: error.message });
  }
};

const updateGstReturn = async (req, res) => {
  const { period, gst_type, total_taxable_value, total_cgst, total_sgst, total_igst, total_tax, status } = req.body;

  try {
    await query(
      `UPDATE gst_returns
       SET period = ?, gst_type = ?, total_taxable_value = ?, total_cgst = ?, total_sgst = ?, total_igst = ?, total_tax = ?, status = ?
       WHERE id = ?`,
      [period, gst_type, total_taxable_value, total_cgst, total_sgst, total_igst, total_tax, status, req.params.id],
    );
    res.json({ message: "GST return updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update GST return", error: error.message });
  }
};

const deleteGstReturn = async (req, res) => {
  try {
    await query("DELETE FROM gst_returns WHERE id = ?", [req.params.id]);
    res.json({ message: "GST return deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete GST return", error: error.message });
  }
};

const listVendorPayments = async (req, res) => {
  const { from, to, status } = req.query;

  let sql = "SELECT * FROM vendor_payments WHERE 1 = 1";
  const params = [];

  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY date DESC, id DESC";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch vendor payments", error: error.message });
  }
};

const addVendorPayment = async (req, res) => {
  const { date, vendor_name, amount, payment_mode, description, status } = req.body;

  try {
    const result = await query(
      `INSERT INTO vendor_payments (date, vendor_name, amount, payment_mode, description, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [date || new Date().toISOString().slice(0, 10), vendor_name, amount, payment_mode, description, status || "Pending"],
    );
    res.status(201).json({ message: "Vendor payment added", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add vendor payment", error: error.message });
  }
};

const updateVendorPayment = async (req, res) => {
  const { date, vendor_name, amount, payment_mode, description, status } = req.body;

  try {
    await query(
      `UPDATE vendor_payments
       SET date = ?, vendor_name = ?, amount = ?, payment_mode = ?, description = ?, status = ?
       WHERE id = ?`,
      [date, vendor_name, amount, payment_mode, description, status, req.params.id],
    );
    res.json({ message: "Vendor payment updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update vendor payment", error: error.message });
  }
};

const deleteVendorPayment = async (req, res) => {
  try {
    await query("DELETE FROM vendor_payments WHERE id = ?", [req.params.id]);
    res.json({ message: "Vendor payment deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete vendor payment", error: error.message });
  }
};

const listPurchaseOrders = async (req, res) => {
  const { from, to, status } = req.query;

  let sql = "SELECT * FROM purchase_orders WHERE 1 = 1";
  const params = [];

  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY date DESC, id DESC";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch purchase orders", error: error.message });
  }
};

const addPurchaseOrder = async (req, res) => {
  const { date, vendor_name, item_description, amount, status } = req.body;

  try {
    const result = await query(
      `INSERT INTO purchase_orders (date, vendor_name, item_description, amount, status)
       VALUES (?, ?, ?, ?, ?)`,
      [date || new Date().toISOString().slice(0, 10), vendor_name, item_description, amount, status || "Pending"],
    );
    res.status(201).json({ message: "Purchase order added", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add purchase order", error: error.message });
  }
};

const updatePurchaseOrder = async (req, res) => {
  const { date, vendor_name, item_description, amount, status } = req.body;

  try {
    await query(
      `UPDATE purchase_orders
       SET date = ?, vendor_name = ?, item_description = ?, amount = ?, status = ?
       WHERE id = ?`,
      [date, vendor_name, item_description, amount, status, req.params.id],
    );
    res.json({ message: "Purchase order updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update purchase order", error: error.message });
  }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    await query("DELETE FROM purchase_orders WHERE id = ?", [req.params.id]);
    res.json({ message: "Purchase order deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete purchase order", error: error.message });
  }
};

const listPayrollRecords = async (req, res) => {
  const { from, to, department } = req.query;

  let sql = "SELECT * FROM payroll_records WHERE 1 = 1";
  const params = [];

  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }
  if (department) {
    sql += " AND department = ?";
    params.push(department);
  }

  sql += " ORDER BY date DESC, id DESC";

  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payroll records", error: error.message });
  }
};

const addPayrollRecord = async (req, res) => {
  const { date, employee_name, department, amount, notes } = req.body;

  try {
    const result = await query(
      `INSERT INTO payroll_records (date, employee_name, department, amount, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [date || new Date().toISOString().slice(0, 10), employee_name, department, amount, notes || null],
    );
    res.status(201).json({ message: "Payroll record added", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add payroll record", error: error.message });
  }
};

const updatePayrollRecord = async (req, res) => {
  const { date, employee_name, department, amount, notes } = req.body;

  try {
    await query(
      `UPDATE payroll_records
       SET date = ?, employee_name = ?, department = ?, amount = ?, notes = ?
       WHERE id = ?`,
      [date, employee_name, department, amount, notes, req.params.id],
    );
    res.json({ message: "Payroll record updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update payroll record", error: error.message });
  }
};

const deletePayrollRecord = async (req, res) => {
  try {
    await query("DELETE FROM payroll_records WHERE id = ?", [req.params.id]);
    res.json({ message: "Payroll record deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete payroll record", error: error.message });
  }
};

const listProfitCenters = async (req, res) => {
  try {
    const results = await query("SELECT * FROM profit_centers ORDER BY name ASC, id ASC");
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profit centers", error: error.message });
  }
};

const addProfitCenter = async (req, res) => {
  const { name, code, description, is_active } = req.body;

  try {
    const result = await query(
      `INSERT INTO profit_centers (name, code, description, is_active)
       VALUES (?, ?, ?, ?)`,
      [name, code, description, is_active !== false ? 1 : 0],
    );
    res.status(201).json({ message: "Profit center added", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add profit center", error: error.message });
  }
};

const updateProfitCenter = async (req, res) => {
  const { name, code, description, is_active } = req.body;

  try {
    await query(
      `UPDATE profit_centers SET name = ?, code = ?, description = ?, is_active = ? WHERE id = ?`,
      [name, code, description, is_active !== false ? 1 : 0, req.params.id],
    );
    res.json({ message: "Profit center updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profit center", error: error.message });
  }
};

const deleteProfitCenter = async (req, res) => {
  try {
    await query("DELETE FROM profit_centers WHERE id = ?", [req.params.id]);
    res.json({ message: "Profit center deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete profit center", error: error.message });
  }
};

const listPaymentGatewaySettings = async (req, res) => {
  try {
    const results = await query("SELECT * FROM payment_gateway_settings ORDER BY id ASC");
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payment gateway settings", error: error.message });
  }
};

const addPaymentGatewaySetting = async (req, res) => {
  const { gateway_name, api_key, api_secret, merchant_id, environment, is_active, description } = req.body;

  try {
    const result = await query(
      `INSERT INTO payment_gateway_settings (gateway_name, api_key, api_secret, merchant_id, environment, is_active, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        gateway_name,
        api_key || null,
        api_secret || null,
        merchant_id || null,
        environment || "sandbox",
        is_active !== false ? 1 : 0,
        description || null,
      ],
    );
    res.status(201).json({ message: "Payment gateway setting added", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add payment gateway setting", error: error.message });
  }
};

const updatePaymentGatewaySetting = async (req, res) => {
  const { gateway_name, api_key, api_secret, merchant_id, environment, is_active, description } = req.body;

  try {
    await query(
      `UPDATE payment_gateway_settings
       SET gateway_name = ?, api_key = ?, api_secret = ?, merchant_id = ?, environment = ?, is_active = ?, description = ?
       WHERE id = ?`,
      [gateway_name, api_key, api_secret, merchant_id, environment, is_active !== false ? 1 : 0, description, req.params.id],
    );
    res.json({ message: "Payment gateway setting updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update payment gateway setting", error: error.message });
  }
};

const deletePaymentGatewaySetting = async (req, res) => {
  try {
    await query("DELETE FROM payment_gateway_settings WHERE id = ?", [req.params.id]);
    res.json({ message: "Payment gateway setting deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete payment gateway setting", error: error.message });
  }
};

const getPaymentGatewaySettingById = async (req, res) => {
  try {
    const results = await query("SELECT * FROM payment_gateway_settings WHERE id = ?", [req.params.id]);
    res.json(results[0] || null);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payment gateway setting", error: error.message });
  }
};

const getBankLedgerBySource = async (req, res) => {
  const { source } = req.params;

  try {
    const results = await query(
      "SELECT * FROM bank_ledger WHERE source = ? ORDER BY date DESC, id DESC",
      [source],
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bank ledger by source", error: error.message });
  }
};

const getTransactionsByModule = async (req, res) => {
  const { module } = req.params;
  const { from, to } = req.query;

  let sql = `
    SELECT
      id,
      date,
      type,
      department,
      source_module,
      description,
      amount,
      payment_mode
    FROM accounts_transactions
    WHERE source_module = ?
  `;
  const params = [module];

  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }

  sql += " ORDER BY date DESC, id DESC";

  try {
    const results = await query(sql, params);
    const totals = results.reduce(
      (acc, row) => {
        const amount = Number(row.amount || 0);
        if (row.type === "Income") {
          acc.income += amount;
        } else if (row.type === "Expense") {
          acc.expense += amount;
        }
        return acc;
      },
      { income: 0, expense: 0 },
    );
    totals.balance = totals.income - totals.expense;

    res.json({
      transactions: results,
      summary: totals,
      totalRecords: results.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch module transactions", error: error.message });
  }
};

const getSourceModules = async (req, res) => {
  try {
    const results = await query(
      `
        SELECT DISTINCT source_module
        FROM accounts_transactions
        WHERE source_module IS NOT NULL AND TRIM(source_module) <> ''
        ORDER BY source_module ASC
      `
    );
    const modules = results.map((row) => row.source_module);
    res.json({ modules });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch source modules", error: error.message });
  }
};

const createBillPayment = async (req, res) => {
  const { billId, amount, paymentMode, notes } = req.body;

  try {
    const result = await query(
      `
        INSERT INTO payment_history (booking_id, bill_id, amount, payment_mode, description)
        VALUES (NULL, ?, ?, ?, ?)
      `,
      [billId, amount, paymentMode || "Cash", notes || null],
    );

    res.json({ message: "Bill payment recorded", id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to record bill payment", error: error.message });
  }
};

exports.getSummary = getSummary;
exports.getTransactions = getTransactions;
exports.createTransaction = createTransaction;
exports.getTransactionById = getTransactionById;
exports.updateTransaction = updateTransaction;
exports.deleteTransaction = deleteTransaction;
exports.getDepartmentSummary = getDepartmentSummary;
exports.getHotelBillingRecords = getHotelBillingRecords;
exports.getRestaurantBillingRecords = getRestaurantBillingRecords;
exports.getAllPaymentHistory = getAllPaymentHistory;
exports.savePaymentHistory = savePaymentHistory;

exports.getExtendedSummary = getExtendedSummary;
exports.getReconciliationSummary = getReconciliationSummary;
exports.listReconciliationItems = listReconciliationItems;
exports.matchBankLedger = matchBankLedger;
exports.unmatchBankLedger = unmatchBankLedger;
exports.listBankLedger = listBankLedger;
exports.addBankLedger = addBankLedger;
exports.updateBankLedger = updateBankLedger;
exports.deleteBankLedger = deleteBankLedger;
exports.listPettyCash = listPettyCash;
exports.addPettyCash = addPettyCash;
exports.updatePettyCash = updatePettyCash;
exports.deletePettyCash = deletePettyCash;
exports.listGstReturns = listGstReturns;
exports.addGstReturn = addGstReturn;
exports.updateGstReturn = updateGstReturn;
exports.deleteGstReturn = deleteGstReturn;
exports.listVendorPayments = listVendorPayments;
exports.addVendorPayment = addVendorPayment;
exports.updateVendorPayment = updateVendorPayment;
exports.deleteVendorPayment = deleteVendorPayment;
exports.listPurchaseOrders = listPurchaseOrders;
exports.addPurchaseOrder = addPurchaseOrder;
exports.updatePurchaseOrder = updatePurchaseOrder;
exports.deletePurchaseOrder = deletePurchaseOrder;
exports.listPayrollRecords = listPayrollRecords;
exports.addPayrollRecord = addPayrollRecord;
exports.updatePayrollRecord = updatePayrollRecord;
exports.deletePayrollRecord = deletePayrollRecord;
exports.listProfitCenters = listProfitCenters;
exports.addProfitCenter = addProfitCenter;
exports.updateProfitCenter = updateProfitCenter;
exports.deleteProfitCenter = deleteProfitCenter;
exports.listPaymentGatewaySettings = listPaymentGatewaySettings;
exports.addPaymentGatewaySetting = addPaymentGatewaySetting;
exports.updatePaymentGatewaySetting = updatePaymentGatewaySetting;
exports.deletePaymentGatewaySetting = deletePaymentGatewaySetting;
exports.getPaymentGatewaySettingById = getPaymentGatewaySettingById;
exports.getBankLedgerBySource = getBankLedgerBySource;
exports.getTransactionsByModule = getTransactionsByModule;
exports.getSourceModules = getSourceModules;
exports.createBillPayment = createBillPayment;

const addIncome = async (req, res) => res.status(501).json({ message: "Not implemented" });
const addExpense = async (req, res) => res.status(501).json({ message: "Not implemented" });
const settlePendingBill = async (req, res) => res.status(501).json({ message: "Not implemented" });

exports.addIncome = addIncome;
exports.addExpense = addExpense;
exports.settlePendingBill = settlePendingBill;
