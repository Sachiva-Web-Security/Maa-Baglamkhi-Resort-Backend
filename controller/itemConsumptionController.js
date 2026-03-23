const ItemConsumption = require("../models/ItemConsumptionModel");

const sendError = (res, error, fallback = "Something went wrong") =>
  res.status(500).json({ message: error.message || fallback });

exports.getBootstrap = async (req, res) => {
  try {
    const data = await ItemConsumption.getBootstrapData();
    res.json(data);
  } catch (error) {
    sendError(res, error, "Failed to load consumption bootstrap data");
  }
};

exports.upsertIngredient = async (req, res) => {
  try {
    const result = await ItemConsumption.upsertIngredient(req.body);
    res.json({ message: "Ingredient saved successfully", ...result });
  } catch (error) {
    sendError(res, error, "Failed to save ingredient");
  }
};

exports.getIngredients = async (req, res) => {
  try {
    const rows = await ItemConsumption.getIngredients();
    res.json(rows);
  } catch (error) {
    sendError(res, error, "Failed to fetch ingredients");
  }
};

exports.saveRecipe = async (req, res) => {
  try {
    if (!req.body.menuItemId || !Array.isArray(req.body.lines) || !req.body.lines.length) {
      return res.status(400).json({ message: "menuItemId and recipe lines are required" });
    }

    const result = await ItemConsumption.createOrUpdateRecipe(req.body);
    res.json(result);
  } catch (error) {
    sendError(res, error, "Failed to save recipe");
  }
};

exports.getRecipeByItem = async (req, res) => {
  try {
    const recipe = await ItemConsumption.getRecipeByItem(req.params.menuItemId);
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found" });
    }
    res.json(recipe);
  } catch (error) {
    sendError(res, error, "Failed to fetch recipe");
  }
};

exports.createSale = async (req, res) => {
  try {
    if (!req.body.referenceNo || !Array.isArray(req.body.items) || !req.body.items.length) {
      return res.status(400).json({ message: "referenceNo and sale items are required" });
    }

    const result = await ItemConsumption.createSaleWithConsumption(req.body);
    res.json(result);
  } catch (error) {
    if (String(error.message || "").toLowerCase().includes("insufficient stock")) {
      return res.status(400).json({ message: error.message });
    }
    sendError(res, error, "Failed to create sale consumption");
  }
};

exports.cancelSale = async (req, res) => {
  try {
    const result = await ItemConsumption.reverseSaleConsumption({
      saleOrderId: req.params.saleOrderId,
      updatedBy: req.body.updatedBy || "system",
      notes: req.body.notes,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error, "Failed to reverse consumption");
  }
};

exports.getConsumptionReport = async (req, res) => {
  try {
    const rows = await ItemConsumption.getConsumptionReport(req.query);
    res.json(rows);
  } catch (error) {
    sendError(res, error, "Failed to fetch consumption report");
  }
};

exports.getIngredientSummary = async (req, res) => {
  try {
    const rows = await ItemConsumption.getIngredientConsumptionSummary(req.query);
    res.json(rows);
  } catch (error) {
    sendError(res, error, "Failed to fetch ingredient summary");
  }
};

exports.getStockImpact = async (req, res) => {
  try {
    const rows = await ItemConsumption.getStockImpactView(req.query);
    res.json(rows);
  } catch (error) {
    sendError(res, error, "Failed to fetch stock impact view");
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const summary = await ItemConsumption.getDashboardSummary(req.query);
    res.json(summary);
  } catch (error) {
    sendError(res, error, "Failed to fetch dashboard summary");
  }
};

exports.reconcileStock = async (req, res) => {
  try {
    if (!req.body.ingredientId) {
      return res.status(400).json({ message: "ingredientId is required" });
    }

    const result = await ItemConsumption.reconcileStock(req.body);
    res.json(result);
  } catch (error) {
    sendError(res, error, "Failed to reconcile stock");
  }
};
