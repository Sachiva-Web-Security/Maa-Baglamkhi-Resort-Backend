const router = require("express").Router();
const {
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  addIncome,
  addExpense,
  getSummary,
  getDepartmentSummary,
  getHotelBillingRecords,
  getRestaurantBillingRecords,
  getExtendedSummary,
  getReconciliationSummary,
  listReconciliationItems,
  matchBankLedger,
  unmatchBankLedger,
  listBankLedger,
  addBankLedger,
  updateBankLedger,
  deleteBankLedger,
  listPettyCash,
  addPettyCash,
  updatePettyCash,
  deletePettyCash,
  listGstReturns,
  addGstReturn,
  updateGstReturn,
  deleteGstReturn,
  listVendorPayments,
  addVendorPayment,
  updateVendorPayment,
  deleteVendorPayment,
  listPurchaseOrders,
  addPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  listPayrollRecords,
  addPayrollRecord,
  updatePayrollRecord,
  deletePayrollRecord,
  listProfitCenters,
  addProfitCenter,
  updateProfitCenter,
  deleteProfitCenter,
  listPaymentGatewaySettings,
  addPaymentGatewaySetting,
  updatePaymentGatewaySetting,
  deletePaymentGatewaySetting,
  settlePendingBill,
  getAllPaymentHistory,
} = require("../controller/accountsController");

router.get("/transactions", getTransactions);
router.get("/transactions/:id", getTransactionById);
router.put("/transactions/:id", updateTransaction);
router.delete("/transactions/:id", deleteTransaction);
router.get("/summary", getSummary);
router.get("/department-summary", getDepartmentSummary);
router.get("/hotel-billing", getHotelBillingRecords);
router.get("/restaurant-billing", getRestaurantBillingRecords);
router.post("/income", addIncome);
router.post("/expense", addExpense);

router.get("/extended-summary", getExtendedSummary);
router.get("/reconciliation/summary", getReconciliationSummary);
router.get("/reconciliation/items", listReconciliationItems);
router.post("/reconciliation/match", matchBankLedger);
router.post("/reconciliation/unmatch", unmatchBankLedger);
router.post("/settle-pending-bill", settlePendingBill);
router.get("/bank-ledger", listBankLedger);
router.post("/bank-ledger", addBankLedger);
router.put("/bank-ledger/:id", updateBankLedger);
router.delete("/bank-ledger/:id", deleteBankLedger);
router.get("/petty-cash", listPettyCash);
router.post("/petty-cash", addPettyCash);
router.put("/petty-cash/:id", updatePettyCash);
router.delete("/petty-cash/:id", deletePettyCash);
router.get("/gst-returns", listGstReturns);
router.post("/gst-returns", addGstReturn);
router.put("/gst-returns/:id", updateGstReturn);
router.delete("/gst-returns/:id", deleteGstReturn);
router.get("/vendor-payments", listVendorPayments);
router.post("/vendor-payments", addVendorPayment);
router.put("/vendor-payments/:id", updateVendorPayment);
router.delete("/vendor-payments/:id", deleteVendorPayment);
router.get("/purchase-orders", listPurchaseOrders);
router.post("/purchase-orders", addPurchaseOrder);
router.put("/purchase-orders/:id", updatePurchaseOrder);
router.delete("/purchase-orders/:id", deletePurchaseOrder);
router.get("/payroll", listPayrollRecords);
router.post("/payroll", addPayrollRecord);
router.put("/payroll/:id", updatePayrollRecord);
router.delete("/payroll/:id", deletePayrollRecord);
router.get("/profit-centers", listProfitCenters);
router.post("/profit-centers", addProfitCenter);
router.put("/profit-centers/:id", updateProfitCenter);
router.delete("/profit-centers/:id", deleteProfitCenter);
router.get("/payment-settings", listPaymentGatewaySettings);
router.delete("/payment-settings/:id", deletePaymentGatewaySetting);
router.get("/payment-history", getAllPaymentHistory);

module.exports = router;
