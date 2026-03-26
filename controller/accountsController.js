const AccountsModel = require("../models/AccountsModel");
const AccountsExpansionModel = require("../models/AccountsExpansionModel");

exports.getTransactions = (req, res) => {
  AccountsModel.getTransactions((err, rows) => {
    if (err) {
      console.error("Error fetching transactions:", err);
      return res.status(500).json({ message: "Error fetching transactions" });
    }
    res.json(rows);
  });
};

exports.addIncome = (req, res) => {
  const { date, description, amount, paymentMode } = req.body;
  if (!date || !description || amount == null || !paymentMode) {
    return res.status(400).json({ message: "Missing fields" });
  }

  AccountsModel.createTransaction(
    { date, type: "Income", description, amount, paymentMode },
    (err, result) => {
      if (err) {
        console.error("Error adding income:", err);
        return res.status(500).json({ message: "Error adding income" });
      }
      res.json({ message: "Income added", id: result.insertId });
    }
  );
};

exports.addExpense = (req, res) => {
  const { date, description, amount, paymentMode } = req.body;
  if (!date || !description || amount == null || !paymentMode) {
    return res.status(400).json({ message: "Missing fields" });
  }

  AccountsModel.createTransaction(
    { date, type: "Expense", description, amount, paymentMode },
    (err, result) => {
      if (err) {
        console.error("Error adding expense:", err);
        return res.status(500).json({ message: "Error adding expense" });
      }
      res.json({ message: "Expense added", id: result.insertId });
    }
  );
};

exports.getSummary = (req, res) => {
  AccountsModel.getSummary((err, results) => {
    if (err) {
      console.error("Error fetching summary:", err);
      return res.status(500).json({ message: "Error fetching summary" });
    }

    const income = Number(results[0].totalIncome) || 0;
    const expense = Number(results[0].totalExpense) || 0;
    const net = income - expense;
    const gstPayable = Math.round(income * 0.05);

    res.json({ income, expense, net, gstPayable });
  });
};

const handleList = async (res, loader, errorMessage) => {
  try {
    const rows = await loader();
    res.json(rows);
  } catch (error) {
    console.error(errorMessage, error);
    res.status(500).json({ message: errorMessage });
  }
};

const handleCreate = async (req, res, mapper, saver, successMessage, errorMessage) => {
  try {
    const payload = mapper(req.body || {});
    const result = await saver(payload);
    res.json({ message: successMessage, id: result.insertId });
  } catch (error) {
    console.error(errorMessage, error);
    res.status(500).json({ message: errorMessage });
  }
};

exports.getExtendedSummary = async (req, res) => {
  try {
    const summary = await AccountsExpansionModel.getExtendedSummary();
    res.json(summary);
  } catch (error) {
    console.error("Error fetching accounts extended summary:", error);
    res.status(500).json({ message: "Error fetching accounts extended summary" });
  }
};

exports.getBankLedger = (req, res) =>
  handleList(res, AccountsExpansionModel.listBankLedger, "Error fetching bank ledger");

exports.addBankLedger = (req, res) =>
  handleCreate(
    req,
    res,
    (body) => ({
      entry_date: body.entryDate,
      bank_name: body.bankName,
      reference_no: body.referenceNo || null,
      description: body.description,
      debit: Number(body.debit || 0),
      credit: Number(body.credit || 0),
      reconciliation_status: body.reconciliationStatus || "Pending",
      notes: body.notes || null,
    }),
    AccountsExpansionModel.addBankLedger,
    "Bank ledger entry added",
    "Error adding bank ledger entry",
  );

exports.getPettyCash = (req, res) =>
  handleList(res, AccountsExpansionModel.listPettyCash, "Error fetching petty cash");

exports.addPettyCash = (req, res) =>
  handleCreate(
    req,
    res,
    (body) => ({
      entry_date: body.entryDate,
      entry_type: body.entryType,
      category: body.category,
      description: body.description,
      amount: Number(body.amount || 0),
      approved_by: body.approvedBy || null,
      notes: body.notes || null,
    }),
    AccountsExpansionModel.addPettyCash,
    "Petty cash entry added",
    "Error adding petty cash entry",
  );

exports.getGstReturns = (req, res) =>
  handleList(res, AccountsExpansionModel.listGstReturns, "Error fetching GST returns");

exports.addGstReturn = (req, res) =>
  handleCreate(
    req,
    res,
    (body) => ({
      filing_period: body.filingPeriod,
      return_type: body.returnType,
      taxable_amount: Number(body.taxableAmount || 0),
      gst_collected: Number(body.gstCollected || 0),
      gst_paid: Number(body.gstPaid || 0),
      net_payable: Number(body.netPayable || 0),
      status: body.status || "Draft",
      filed_on: body.filedOn || null,
      notes: body.notes || null,
    }),
    AccountsExpansionModel.addGstReturn,
    "GST return record added",
    "Error adding GST return record",
  );

exports.getVendorPayments = (req, res) =>
  handleList(res, AccountsExpansionModel.listVendorPayments, "Error fetching vendor payments");

exports.addVendorPayment = (req, res) =>
  handleCreate(
    req,
    res,
    (body) => ({
      vendor_name: body.vendorName,
      invoice_ref: body.invoiceRef || null,
      payment_date: body.paymentDate,
      amount: Number(body.amount || 0),
      payment_mode: body.paymentMode || "Bank Transfer",
      status: body.status || "Scheduled",
      notes: body.notes || null,
    }),
    AccountsExpansionModel.addVendorPayment,
    "Vendor payment added",
    "Error adding vendor payment",
  );

exports.getPurchaseOrders = (req, res) =>
  handleList(res, AccountsExpansionModel.listPurchaseOrders, "Error fetching purchase orders");

exports.addPurchaseOrder = (req, res) =>
  handleCreate(
    req,
    res,
    (body) => ({
      po_number: body.poNumber,
      vendor_name: body.vendorName,
      order_date: body.orderDate,
      expected_date: body.expectedDate || null,
      total_amount: Number(body.totalAmount || 0),
      status: body.status || "Draft",
      notes: body.notes || null,
    }),
    AccountsExpansionModel.addPurchaseOrder,
    "Purchase order added",
    "Error adding purchase order",
  );

exports.getPayrollRecords = (req, res) =>
  handleList(res, AccountsExpansionModel.listPayrollRecords, "Error fetching payroll records");

exports.addPayrollRecord = (req, res) =>
  handleCreate(
    req,
    res,
    (body) => ({
      staff_name: body.staffName,
      payroll_month: body.payrollMonth,
      attendance_days: Number(body.attendanceDays || 0),
      base_salary: Number(body.baseSalary || 0),
      allowance: Number(body.allowance || 0),
      deduction: Number(body.deduction || 0),
      net_salary: Number(body.netSalary || 0),
      status: body.status || "Draft",
      notes: body.notes || null,
    }),
    AccountsExpansionModel.addPayrollRecord,
    "Payroll record added",
    "Error adding payroll record",
  );

exports.getProfitCenters = (req, res) =>
  handleList(res, AccountsExpansionModel.listProfitCenters, "Error fetching profit center records");

exports.addProfitCenter = (req, res) =>
  handleCreate(
    req,
    res,
    (body) => ({
      center_name: body.centerName,
      entry_date: body.entryDate,
      income_amount: Number(body.incomeAmount || 0),
      expense_amount: Number(body.expenseAmount || 0),
      notes: body.notes || null,
    }),
    AccountsExpansionModel.addProfitCenter,
    "Profit center record added",
    "Error adding profit center record",
  );
