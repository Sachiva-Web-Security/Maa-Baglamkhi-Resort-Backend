const AccountsModel = require("../models/AccountsModel");
const AccountsExpansionModel = require("../models/AccountsExpansionModel");
const InvoiceModel = require("../models/InvoiceModel");
const RestaurantModel = require("../models/RestaurantModel");
const upload = require("../utils/upload");

exports.paymentQrUpload = upload.single("qrImage");

const getAccountsSummaryRow = () =>
  new Promise((resolve, reject) => {
    AccountsModel.getSummary((err, results) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(results?.[0] || {});
    });
  });

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
  const { date, description, amount, paymentMode, department, sourceModule } = req.body;
  if (!date || !description || amount == null || !paymentMode) {
    return res.status(400).json({ message: "Missing fields" });
  }

  AccountsModel.createTransaction(
    { date, type: "Income", description, amount, paymentMode, department, sourceModule },
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
  const { date, description, amount, paymentMode, department, sourceModule } = req.body;
  if (!date || !description || amount == null || !paymentMode) {
    return res.status(400).json({ message: "Missing fields" });
  }

  AccountsModel.createTransaction(
    { date, type: "Expense", description, amount, paymentMode, department, sourceModule },
    (err, result) => {
      if (err) {
        console.error("Error adding expense:", err);
        return res.status(500).json({ message: "Error adding expense" });
      }
      res.json({ message: "Expense added", id: result.insertId });
    }
  );
};

const mapTransactionBody = (body) => ({
  date: body.date,
  type: body.type,
  department: body.department || "Other",
  source_module: body.sourceModule || null,
  description: body.description,
  amount: Number(body.amount || 0),
  payment_mode: body.paymentMode,
});

exports.getTransactionById = async (req, res) => {
  try {
    const row = await AccountsModel.getTransactionById(req.params.id);
    if (!row) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    res.json(row);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ message: "Error fetching transaction" });
  }
};

exports.updateTransaction = async (req, res) => {
  try {
    const body = req.body || {};

    // Validate required fields
    const requiredFields = ["date", "type", "description", "amount", "paymentMode"];
    const missingFields = requiredFields.filter(f => {
      const value = body[f];
      return value === undefined || value === null || String(value).trim() === "";
    });
    if (missingFields.length > 0) {
      return res.status(400).json({ message: `${missingFields.join(", ")} is required` });
    }

    if (!["Income", "Expense"].includes(body.type)) {
      return res.status(400).json({ message: "type must be Income or Expense" });
    }

    const amountNumber = Number(body.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    const existingRow = await AccountsModel.getTransactionById(req.params.id);
    if (!existingRow) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const result = await AccountsModel.updateTransaction(req.params.id, {
      ...mapTransactionBody(body),
      updatedBy: req.user?.id || null,
    });

    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json({ message: "Transaction updated" });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ message: "Error updating transaction" });
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    const existingRow = await AccountsModel.getTransactionById(req.params.id);
    if (!existingRow) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const result = await AccountsModel.deleteTransaction(req.params.id);
    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json({ message: "Transaction deleted" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ message: "Error deleting transaction" });
  }
};

exports.getSummary = (req, res) => {
  AccountsModel.getSummary((err, results) => {
    if (err) {
      console.error("Error fetching summary:", err);
      return res.status(500).json({ message: "Error fetching summary" });
    }

    const row = results?.[0] || {};
    const income =
      (Number(row.invoiceIncome) || 0) +
      (Number(row.hotelAdvanceIncome) || 0) +
      (Number(row.restaurantIncome) || 0) +
      (Number(row.banquetIncome) || 0) +
      (Number(row.manualIncome) || 0);
    const expense = Number(row.totalExpense) || 0;
    const net = income - expense;
    const gstPayable =
      (Number(row.invoiceGst) || 0) +
      (Number(row.hotelAdvanceGst) || 0) +
      (Number(row.restaurantGst) || 0) +
      (Number(row.banquetGst) || 0);

    res.json({ income, expense, net, gstPayable });
  });
};

exports.getDepartmentSummary = (req, res) => {
  AccountsModel.getDepartmentSummary((err, results) => {
    if (err) {
      console.error("Error fetching department summary:", err);
      return res.status(500).json({ message: "Error fetching department summary" });
    }

    const row = results?.[0] || {};
    res.json({
      roomIncome: Number(row.roomIncome) || 0,
      restaurantIncome: Number(row.restaurantIncome) || 0,
      banquetIncome: Number(row.banquetIncome) || 0,
      roomExpense: Number(row.roomExpense) || 0,
      restaurantExpense: Number(row.restaurantExpense) || 0,
      banquetExpense: Number(row.banquetExpense) || 0,
    });
  });
};

exports.getHotelBillingRecords = (req, res) => {
  AccountsModel.getHotelBillingRecords((err, rows) => {
    if (err) {
      console.error("Error fetching hotel billing records:", err);
      return res.status(500).json({ message: "Error fetching hotel billing records" });
    }

    res.json(rows || []);
  });
};

exports.getRestaurantBillingRecords = (req, res) => {
  AccountsModel.getRestaurantBillingRecords((err, rows) => {
    if (err) {
      console.error("Error fetching restaurant billing records:", err);
      return res.status(500).json({ message: "Error fetching restaurant billing records" });
    }

    res.json(rows || []);
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

const handleUpdate = async (req, res, mapper, saver, successMessage, errorMessage) => {
  try {
    const payload = mapper(req.body || {});
    const result = await saver(req.params.id, payload);

    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.json({ message: successMessage });
  } catch (error) {
    console.error(errorMessage, error);
    res.status(500).json({ message: errorMessage });
  }
};

const handleDelete = async (req, res, remover, successMessage, errorMessage) => {
  try {
    const result = await remover(req.params.id);

    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.json({ message: successMessage });
  } catch (error) {
    console.error(errorMessage, error);
    res.status(500).json({ message: errorMessage });
  }
};

exports.getExtendedSummary = async (req, res) => {
  try {
    const [extendedSummary, summaryRow] = await Promise.all([
      AccountsExpansionModel.getExtendedSummary(),
      getAccountsSummaryRow(),
    ]);

    const derivedGstPayable =
      (Number(summaryRow.invoiceGst) || 0) +
      (Number(summaryRow.hotelAdvanceGst) || 0) +
      (Number(summaryRow.restaurantGst) || 0) +
      (Number(summaryRow.banquetGst) || 0);

    res.json({
      ...extendedSummary,
      gstPendingPayable:
        Number(extendedSummary.gstPendingPayable) > 0
          ? Number(extendedSummary.gstPendingPayable)
          : derivedGstPayable,
    });
  } catch (error) {
    console.error("Error fetching accounts extended summary:", error);
    res.status(500).json({ message: "Error fetching accounts extended summary" });
  }
};

exports.getReconciliationSummary = async (req, res) => {
  try {
    const summary = await AccountsExpansionModel.getReconciliationSummary({
      paymentMode: req.query.paymentMode,
      sourceType: req.query.sourceType,
      matchStatus: req.query.matchStatus,
    });
    res.json(summary);
  } catch (error) {
    console.error("Error fetching reconciliation summary:", error);
    res.status(500).json({ message: "Error fetching reconciliation summary" });
  }
};

exports.getReconciliationItems = async (req, res) => {
  try {
    const items = await AccountsExpansionModel.listReconciliationItems({
      paymentMode: req.query.paymentMode,
      sourceType: req.query.sourceType,
      matchStatus: req.query.matchStatus,
    });
    res.json(items);
  } catch (error) {
    console.error("Error fetching reconciliation items:", error);
    res.status(500).json({ message: "Error fetching reconciliation items" });
  }
};

exports.matchBankLedger = async (req, res) => {
  try {
    const result = await AccountsExpansionModel.matchBankLedger({
      bankLedgerId: req.body.bankLedgerId,
      sourceType: req.body.sourceType,
      sourceId: req.body.sourceId,
      matchedAmount: req.body.matchedAmount,
    });

    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Bank ledger record not found" });
    }

    res.json({ message: "Bank ledger linked successfully" });
  } catch (error) {
    console.error("Error matching bank ledger:", error);
    res.status(500).json({ message: "Error matching bank ledger" });
  }
};

exports.unmatchBankLedger = async (req, res) => {
  try {
    const result = await AccountsExpansionModel.unmatchBankLedger({
      bankLedgerId: req.body.bankLedgerId,
    });

    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Bank ledger record not found" });
    }

    res.json({ message: "Bank ledger unlinked successfully" });
  } catch (error) {
    console.error("Error unlinking bank ledger:", error);
    res.status(500).json({ message: "Error unlinking bank ledger" });
  }
};

exports.getBankLedger = (req, res) =>
  handleList(res, AccountsExpansionModel.listBankLedger, "Error fetching bank ledger");

exports.addBankLedger = (req, res) =>
  handleCreate(
    req,
    res,
    (body) => ({
      amount: Number(body.amount || body.credit || body.debit || 0),
      direction:
        String(body.direction || "").toLowerCase() === "out" ||
        Number(body.debit || 0) > Number(body.credit || 0)
          ? "out"
          : "in",
      entry_date: body.entryDate,
      bank_name: body.bankName,
      bank_account: body.bankAccount || null,
      reference_no: body.referenceNo || null,
      description: body.description,
      debit: Number(body.debit || 0),
      credit: Number(body.credit || 0),
      source_type: body.sourceType || null,
      source_id: body.sourceId ? Number(body.sourceId) : null,
      payment_mode: body.paymentMode || null,
      reconciliation_status: body.reconciliationStatus || "Pending",
      match_status: body.matchStatus || "unmatched",
      matched_amount: Number(body.matchedAmount || 0),
      statement_ref: body.statementRef || null,
      statement_date: body.statementDate || null,
      reconciled_at:
        body.reconciliationStatus === "Reconciled"
          ? body.reconciledAt || new Date()
          : body.reconciledAt || null,
      notes: body.notes || null,
    }),
    AccountsExpansionModel.addBankLedger,
    "Bank ledger entry added",
    "Error adding bank ledger entry",
  );

exports.updateBankLedger = (req, res) =>
  handleUpdate(
    req,
    res,
    (body) => ({
      amount: Number(body.amount || body.credit || body.debit || 0),
      direction:
        String(body.direction || "").toLowerCase() === "out" ||
        Number(body.debit || 0) > Number(body.credit || 0)
          ? "out"
          : "in",
      entry_date: body.entryDate,
      bank_name: body.bankName,
      bank_account: body.bankAccount || null,
      reference_no: body.referenceNo || null,
      description: body.description,
      debit: Number(body.debit || 0),
      credit: Number(body.credit || 0),
      source_type: body.sourceType || null,
      source_id: body.sourceId ? Number(body.sourceId) : null,
      payment_mode: body.paymentMode || null,
      reconciliation_status: body.reconciliationStatus || "Pending",
      match_status: body.matchStatus || "unmatched",
      matched_amount: Number(body.matchedAmount || 0),
      statement_ref: body.statementRef || null,
      statement_date: body.statementDate || null,
      reconciled_at:
        body.reconciliationStatus === "Reconciled"
          ? body.reconciledAt || new Date()
          : body.reconciledAt || null,
      notes: body.notes || null,
    }),
    AccountsExpansionModel.updateBankLedger,
    "Bank ledger entry updated",
    "Error updating bank ledger entry",
  );

exports.deleteBankLedger = (req, res) =>
  handleDelete(
    req,
    res,
    AccountsExpansionModel.deleteBankLedger,
    "Bank ledger entry deleted",
    "Error deleting bank ledger entry",
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

exports.updatePettyCash = (req, res) =>
  handleUpdate(
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
    AccountsExpansionModel.updatePettyCash,
    "Petty cash entry updated",
    "Error updating petty cash entry",
  );

exports.deletePettyCash = (req, res) =>
  handleDelete(
    req,
    res,
    AccountsExpansionModel.deletePettyCash,
    "Petty cash entry deleted",
    "Error deleting petty cash entry",
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

exports.updateGstReturn = (req, res) =>
  handleUpdate(
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
    AccountsExpansionModel.updateGstReturn,
    "GST return record updated",
    "Error updating GST return record",
  );

exports.deleteGstReturn = (req, res) =>
  handleDelete(
    req,
    res,
    AccountsExpansionModel.deleteGstReturn,
    "GST return record deleted",
    "Error deleting GST return record",
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

exports.updateVendorPayment = (req, res) =>
  handleUpdate(
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
    AccountsExpansionModel.updateVendorPayment,
    "Vendor payment updated",
    "Error updating vendor payment",
  );

exports.deleteVendorPayment = (req, res) =>
  handleDelete(
    req,
    res,
    AccountsExpansionModel.deleteVendorPayment,
    "Vendor payment deleted",
    "Error deleting vendor payment",
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

exports.updatePurchaseOrder = (req, res) =>
  handleUpdate(
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
    AccountsExpansionModel.updatePurchaseOrder,
    "Purchase order updated",
    "Error updating purchase order",
  );

exports.deletePurchaseOrder = (req, res) =>
  handleDelete(
    req,
    res,
    AccountsExpansionModel.deletePurchaseOrder,
    "Purchase order deleted",
    "Error deleting purchase order",
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

exports.updatePayrollRecord = (req, res) =>
  handleUpdate(
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
    AccountsExpansionModel.updatePayrollRecord,
    "Payroll record updated",
    "Error updating payroll record",
  );

exports.deletePayrollRecord = (req, res) =>
  handleDelete(
    req,
    res,
    AccountsExpansionModel.deletePayrollRecord,
    "Payroll record deleted",
    "Error deleting payroll record",
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

exports.updateProfitCenter = (req, res) =>
  handleUpdate(
    req,
    res,
    (body) => ({
      center_name: body.centerName,
      entry_date: body.entryDate,
      income_amount: Number(body.incomeAmount || 0),
      expense_amount: Number(body.expenseAmount || 0),
      notes: body.notes || null,
    }),
    AccountsExpansionModel.updateProfitCenter,
    "Profit center record updated",
    "Error updating profit center record",
  );

exports.deleteProfitCenter = (req, res) =>
  handleDelete(
    req,
    res,
    AccountsExpansionModel.deleteProfitCenter,
    "Profit center record deleted",
    "Error deleting profit center record",
  );

exports.getPaymentGatewaySettings = (req, res) =>
  handleList(
    res,
    AccountsExpansionModel.listPaymentGatewaySettings,
    "Error fetching payment gateway settings",
  );

exports.addPaymentGatewaySetting = async (req, res) => {
  try {
    const payload = {
      payment_mode: req.body.paymentMode,
      department: req.body.department || "Hotel",
      provider_name: req.body.providerName || null,
      upi_id: req.body.upiId || null,
      account_holder_name: req.body.accountHolderName || null,
      bank_name: req.body.bankName || null,
      qr_image_url: req.file ? `/uploads/${req.file.filename}` : req.body.qrImageUrl || null,
      is_active: String(req.body.isActive || "1") === "0" ? 0 : 1,
      notes: req.body.notes || null,
    };

    const result = await AccountsExpansionModel.addPaymentGatewaySetting(payload);
    res.json({ message: "Payment gateway setting added", id: result.insertId });
  } catch (error) {
    console.error("Error adding payment gateway setting:", error);
    res.status(500).json({ message: "Error adding payment gateway setting" });
  }
};

exports.updatePaymentGatewaySetting = async (req, res) => {
  try {
    const existingRows = await AccountsExpansionModel.listPaymentGatewaySettings();
    const existing =
      existingRows.find((row) => Number(row.id) === Number(req.params.id)) || null;

    if (!existing) {
      return res.status(404).json({ message: "Payment gateway setting not found" });
    }

    const payload = {
      payment_mode: req.body.paymentMode,
      department: req.body.department || "Hotel",
      provider_name: req.body.providerName || null,
      upi_id: req.body.upiId || null,
      account_holder_name: req.body.accountHolderName || null,
      bank_name: req.body.bankName || null,
      qr_image_url: req.file
        ? `/uploads/${req.file.filename}`
        : req.body.qrImageUrl || existing.qr_image_url || null,
      is_active: String(req.body.isActive || "1") === "0" ? 0 : 1,
      notes: req.body.notes || null,
    };

    const result = await AccountsExpansionModel.updatePaymentGatewaySetting(
      req.params.id,
      payload,
    );

    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Payment gateway setting not found" });
    }

    res.json({ message: "Payment gateway setting updated" });
  } catch (error) {
    console.error("Error updating payment gateway setting:", error);
    res.status(500).json({ message: "Error updating payment gateway setting" });
  }
};

exports.deletePaymentGatewaySetting = (req, res) =>
  handleDelete(
    req,
    res,
    AccountsExpansionModel.deletePaymentGatewaySetting,
    "Payment gateway setting deleted",
    "Error deleting payment gateway setting",
  );

exports.settlePendingBill = async (req, res) => {
  const {
    sourceType,
    sourceId,
    paymentMode = "UPI",
    paymentSettingId,
    referenceNo,
    notes,
  } = req.body || {};

  if (!sourceType || !sourceId) {
    return res.status(400).json({ message: "sourceType and sourceId are required" });
  }

  try {
    const normalizedMode = String(paymentMode || "UPI").trim() || "UPI";
    const isCashMode = String(normalizedMode).toLowerCase() === "cash";

    const paymentSetting = paymentSettingId
      ? await AccountsExpansionModel.getPaymentGatewaySettingById(paymentSettingId)
      : null;

    let bankLedgerAmount = 0;
    let bankLedgerDescription = "";
    let ledgerSourceType = sourceType;
    let ledgerSourceId = Number(sourceId);

    if (sourceType === "invoice") {
      await InvoiceModel.updatePaymentStatus(sourceId, "Paid", {
        paymentMode: normalizedMode,
        notes,
      });

      const invoice = await new Promise((resolve, reject) => {
        InvoiceModel.getAllInvoices((err, rows) => {
          if (err) return reject(err);
          resolve((rows || []).find((row) => Number(row.id) === Number(sourceId)) || null);
        });
      });

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      bankLedgerAmount = Number(invoice.totalAmount || invoice.total_amount || invoice.final_total || 0);
      bankLedgerDescription = `Invoice payment received - ${invoice.invoice_no || `Invoice #${sourceId}`}`;
    } else if (sourceType === "restaurant_bill") {
      const result = await RestaurantModel.processBillPayment({
        billId: Number(sourceId),
        paymentMethod: normalizedMode,
      });

      const bills = await new Promise((resolve, reject) => {
        RestaurantModel.getBills((err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
      const bill = bills.find((row) => Number(row.id) === Number(sourceId));
      if (!bill) {
        return res.status(404).json({ message: "Restaurant bill not found" });
      }

      bankLedgerAmount = Number(bill.total || 0);
      bankLedgerDescription = `Restaurant bill payment received - Bill #${sourceId}`;
      ledgerSourceId = Number(sourceId);

      if (result?.billId) {
        ledgerSourceId = Number(result.billId);
      }
    } else {
      return res.status(400).json({ message: "Unsupported sourceType" });
    }

    if (!isCashMode) {
      const existingLedger = await AccountsExpansionModel.getBankLedgerBySource(
        ledgerSourceType,
        ledgerSourceId,
      );

      const ledgerPayload = {
        entry_date: new Date().toISOString().slice(0, 10),
        bank_name: paymentSetting?.provider_name || paymentSetting?.bank_name || normalizedMode,
        bank_account: paymentSetting?.account_holder_name || paymentSetting?.upi_id || null,
        reference_no: referenceNo || null,
        description: bankLedgerDescription,
        debit: 0,
        credit: bankLedgerAmount,
        amount: bankLedgerAmount,
        direction: "in",
        source_type: ledgerSourceType,
        source_id: ledgerSourceId,
        payment_mode: normalizedMode,
        reconciliation_status: "Paid",
        match_status: "matched",
        matched_amount: bankLedgerAmount,
        statement_ref: null,
        statement_date: null,
        reconciled_at: null,
        notes:
          [paymentSetting?.upi_id ? `UPI: ${paymentSetting.upi_id}` : null, notes || null]
            .filter(Boolean)
            .join(" | ") || null,
      };

      if (existingLedger) {
        await AccountsExpansionModel.updateBankLedger(existingLedger.id, ledgerPayload);
      } else {
        await AccountsExpansionModel.addBankLedger(ledgerPayload);
      }
    }

    res.json({ message: "Pending bill settled successfully" });
  } catch (error) {
    console.error("Error settling pending bill:", error);
    res.status(500).json({ message: "Error settling pending bill" });
  }
};
