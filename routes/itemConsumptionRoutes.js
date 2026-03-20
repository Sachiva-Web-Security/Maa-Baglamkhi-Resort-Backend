const express = require("express");
const controller = require("../controller/itemConsumptionController");

const router = express.Router();

router.get("/bootstrap", controller.getBootstrap);
router.get("/ingredients", controller.getIngredients);
router.post("/ingredients", controller.upsertIngredient);

router.post("/recipes", controller.saveRecipe);
router.get("/recipes/:menuItemId", controller.getRecipeByItem);

router.post("/sales", controller.createSale);
router.put("/sales/:saleOrderId/cancel", controller.cancelSale);

router.get("/report", controller.getConsumptionReport);
router.get("/ingredient-summary", controller.getIngredientSummary);
router.get("/stock-impact", controller.getStockImpact);
router.get("/dashboard-summary", controller.getDashboardSummary);
router.post("/reconcile", controller.reconcileStock);

module.exports = router;
