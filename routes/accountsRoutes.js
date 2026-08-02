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
  getReconciliationItems,
  matchBankLedger,
  unmatchBankLedger,
  getBankLedger,
  addBankLedger,
  updateBankLedger,
  deleteBankLedger,
  getPettyCash,
  addPettyCash,
  updatePettyCash,
  deletePettyCash,
  getGstReturns,
  addGstReturn,
  updateGstReturn,
  deleteGstReturn,
  getVendorPayments,
  addVendorPayment,
  updateVendorPayment,
  deleteVendorPayment,
  getPurchaseOrders,
  addPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPayrollRecords,
  addPayrollRecord,
  updatePayrollRecord,
  deletePayrollRecord,
  getProfitCenters,
  addProfitCenter,
  updateProfitCenter,
  deleteProfitCenter,
  paymentQrUpload,
  getPaymentGatewaySettings,
  addPaymentGatewaySetting,
  updatePaymentGatewaySetting,
  deletePaymentGatewaySetting,
  settlePendingBill,
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
router.get("/reconciliation/items", getReconciliationItems);
router.post("/reconciliation/match", matchBankLedger);
router.post("/reconciliation/unmatch", unmatchBankLedger);
router.post("/settle-pending-bill", settlePendingBill);
router.get("/bank-ledger", getBankLedger);
router.post("/bank-ledger", addBankLedger);
router.put("/bank-ledger/:id", updateBankLedger);
router.delete("/bank-ledger/:id", deleteBankLedger);
router.get("/petty-cash", getPettyCash);
router.post("/petty-cash", addPettyCash);
router.put("/petty-cash/:id", updatePettyCash);
router.delete("/petty-cash/:id", deletePettyCash);
router.get("/gst-returns", getGstReturns);
router.post("/gst-returns", addGstReturn);
router.put("/gst-returns/:id", updateGstReturn);
router.delete("/gst-returns/:id", deleteGstReturn);
router.get("/vendor-payments", getVendorPayments);
router.post("/vendor-payments", addVendorPayment);
router.put("/vendor-payments/:id", updateVendorPayment);
router.delete("/vendor-payments/:id", deleteVendorPayment);
router.get("/purchase-orders", getPurchaseOrders);
router.post("/purchase-orders", addPurchaseOrder);
router.put("/purchase-orders/:id", updatePurchaseOrder);
router.delete("/purchase-orders/:id", deletePurchaseOrder);
router.get("/payroll", getPayrollRecords);
router.post("/payroll", addPayrollRecord);
router.put("/payroll/:id", updatePayrollRecord);
router.delete("/payroll/:id", deletePayrollRecord);
router.get("/profit-centers", getProfitCenters);
router.post("/profit-centers", addProfitCenter);
router.put("/profit-centers/:id", updateProfitCenter);
router.delete("/profit-centers/:id", deleteProfitCenter);
router.get("/payment-settings", getPaymentGatewaySettings);
router.post("/payment-settings", paymentQrUpload, addPaymentGatewaySetting);
router.put("/payment-settings/:id", paymentQrUpload, updatePaymentGatewaySetting);
router.delete("/payment-settings/:id", deletePaymentGatewaySetting);

module.exports = router;
