const router = require("express").Router();
const {
  getTransactions,
  addIncome,
  addExpense,
  getSummary, // ✅ NEW
} = require("../controller/accountsController");

router.get("/transactions", getTransactions);
router.get("/summary", getSummary); // ✅ NEW
router.post("/income", addIncome);
router.post("/expense", addExpense);

module.exports = router;