const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

async function ensureSchema() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS account_bank_ledgers (
      id INT NOT NULL AUTO_INCREMENT,
      entry_date DATE NOT NULL,
      bank_name VARCHAR(255) NOT NULL,
      reference_no VARCHAR(120) DEFAULT NULL,
      description VARCHAR(255) NOT NULL,
      debit DECIMAL(12,2) NOT NULL DEFAULT 0,
      credit DECIMAL(12,2) NOT NULL DEFAULT 0,
      reconciliation_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_bank_ledger_date (entry_date),
      INDEX idx_bank_ledger_bank (bank_name)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS petty_cash_entries (
      id INT NOT NULL AUTO_INCREMENT,
      entry_date DATE NOT NULL,
      entry_type VARCHAR(20) NOT NULL,
      category VARCHAR(120) NOT NULL,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      approved_by VARCHAR(255) DEFAULT NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_petty_cash_date (entry_date),
      INDEX idx_petty_cash_type (entry_type)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS gst_return_records (
      id INT NOT NULL AUTO_INCREMENT,
      filing_period VARCHAR(20) NOT NULL,
      return_type VARCHAR(50) NOT NULL,
      taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      gst_collected DECIMAL(12,2) NOT NULL DEFAULT 0,
      gst_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
      net_payable DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'Draft',
      filed_on DATE DEFAULT NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_gst_period (filing_period),
      INDEX idx_gst_status (status)
    )
  `);

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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_vendor_payment_date (payment_date),
      INDEX idx_vendor_payment_vendor (vendor_name)
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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_purchase_order_number (po_number),
      INDEX idx_purchase_order_date (order_date)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS payroll_records (
      id INT NOT NULL AUTO_INCREMENT,
      staff_name VARCHAR(255) NOT NULL,
      payroll_month VARCHAR(20) NOT NULL,
      attendance_days INT NOT NULL DEFAULT 0,
      base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
      allowance DECIMAL(12,2) NOT NULL DEFAULT 0,
      deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
      net_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'Draft',
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_payroll_month (payroll_month),
      INDEX idx_payroll_staff (staff_name)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS profit_center_entries (
      id INT NOT NULL AUTO_INCREMENT,
      center_name VARCHAR(100) NOT NULL,
      entry_date DATE NOT NULL,
      income_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      expense_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_profit_center_name (center_name),
      INDEX idx_profit_center_date (entry_date)
    )
  `);
}

const listRows = (tableName, orderColumn = "created_at") =>
  runQuery(`SELECT * FROM ${tableName} ORDER BY ${orderColumn} DESC, id DESC`);

const insertRow = (tableName, data) =>
  runQuery(`INSERT INTO ${tableName} SET ?`, [data]);

async function getExtendedSummary() {
  const [
    bankPending,
    pettyCash,
    gst,
    vendors,
    purchaseOrders,
    payroll,
    profitCenters,
  ] = await Promise.all([
    runQuery("SELECT COUNT(*) AS count FROM account_bank_ledgers WHERE reconciliation_status <> 'Reconciled'"),
    runQuery("SELECT COALESCE(SUM(CASE WHEN entry_type = 'In' THEN amount ELSE -amount END), 0) AS balance FROM petty_cash_entries"),
    runQuery("SELECT COALESCE(SUM(net_payable), 0) AS payable FROM gst_return_records WHERE status <> 'Filed'"),
    runQuery("SELECT COALESCE(SUM(amount), 0) AS total FROM vendor_payment_records WHERE status <> 'Paid'"),
    runQuery("SELECT COUNT(*) AS count FROM purchase_orders WHERE status NOT IN ('Closed', 'Cancelled')"),
    runQuery("SELECT COALESCE(SUM(net_salary), 0) AS total FROM payroll_records"),
    runQuery("SELECT center_name, COALESCE(SUM(income_amount - expense_amount), 0) AS net FROM profit_center_entries GROUP BY center_name ORDER BY center_name"),
  ]);

  return {
    pendingBankReconciliation: Number(bankPending?.[0]?.count || 0),
    pettyCashBalance: Number(pettyCash?.[0]?.balance || 0),
    gstPendingPayable: Number(gst?.[0]?.payable || 0),
    vendorOutstanding: Number(vendors?.[0]?.total || 0),
    openPurchaseOrders: Number(purchaseOrders?.[0]?.count || 0),
    payrollTotal: Number(payroll?.[0]?.total || 0),
    profitCenters: profitCenters.map((row) => ({
      centerName: row.center_name,
      net: Number(row.net || 0),
    })),
  };
}

module.exports = {
  ensureSchema,
  getExtendedSummary,
  listBankLedger: () => listRows("account_bank_ledgers", "entry_date"),
  addBankLedger: (data) => insertRow("account_bank_ledgers", data),
  listPettyCash: () => listRows("petty_cash_entries", "entry_date"),
  addPettyCash: (data) => insertRow("petty_cash_entries", data),
  listGstReturns: () => listRows("gst_return_records", "created_at"),
  addGstReturn: (data) => insertRow("gst_return_records", data),
  listVendorPayments: () => listRows("vendor_payment_records", "payment_date"),
  addVendorPayment: (data) => insertRow("vendor_payment_records", data),
  listPurchaseOrders: () => listRows("purchase_orders", "order_date"),
  addPurchaseOrder: (data) => insertRow("purchase_orders", data),
  listPayrollRecords: () => listRows("payroll_records", "created_at"),
  addPayrollRecord: (data) => insertRow("payroll_records", data),
  listProfitCenters: () => listRows("profit_center_entries", "entry_date"),
  addProfitCenter: (data) => insertRow("profit_center_entries", data),
};
