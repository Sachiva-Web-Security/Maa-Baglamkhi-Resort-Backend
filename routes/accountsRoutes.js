const router = require("express").Router();
const {
  getTransactions,
  addIncome,
  addExpense,
  getSummary,
  getExtendedSummary,
  getBankLedger,
  addBankLedger,
  getPettyCash,
  addPettyCash,
  getGstReturns,
  addGstReturn,
  getVendorPayments,
  addVendorPayment,
  getPurchaseOrders,
  addPurchaseOrder,
  getPayrollRecords,
  addPayrollRecord,
  getProfitCenters,
  addProfitCenter,
} = require("../controller/accountsController");

router.get("/transactions", getTransactions);
router.get("/summary", getSummary);
router.post("/income", addIncome);
router.post("/expense", addExpense);

router.get("/extended-summary", getExtendedSummary);
router.get("/bank-ledger", getBankLedger);
router.post("/bank-ledger", addBankLedger);
router.get("/petty-cash", getPettyCash);
router.post("/petty-cash", addPettyCash);
router.get("/gst-returns", getGstReturns);
router.post("/gst-returns", addGstReturn);
router.get("/vendor-payments", getVendorPayments);
router.post("/vendor-payments", addVendorPayment);
router.get("/purchase-orders", getPurchaseOrders);
router.post("/purchase-orders", addPurchaseOrder);
router.get("/payroll", getPayrollRecords);
router.post("/payroll", addPayrollRecord);
router.get("/profit-centers", getProfitCenters);
router.post("/profit-centers", addProfitCenter);

module.exports = router;
