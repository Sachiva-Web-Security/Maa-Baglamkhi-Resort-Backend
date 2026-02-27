const router = require("express").Router();
const {
  getTransactions,
  addIncome,
  addExpense,
} = require("../controller/accountsController");

router.get("/transactions", getTransactions);
router.post("/income", addIncome);
router.post("/expense", addExpense);

module.exports = router;

