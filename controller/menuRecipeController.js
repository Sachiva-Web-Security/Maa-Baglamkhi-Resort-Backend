const MenuRecipeModel = require("../models/MenuRecipeModel");

const withRecipeSchema = async (res, task) => {
  try {
    await MenuRecipeModel.ensureSchema();
    await task();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to prepare menu recipe schema.",
      error,
    });
  }
};

const parseRecipeRows = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      inventoryItemId: Number(row.inventoryItemId || 0),
      quantity: Number(row.quantity || 0),
      unit: String(row.unit || "").trim(),
      wastagePercent: Number(row.wastagePercent || 0),
      isOptional: Boolean(row.isOptional),
      notes: String(row.notes || "").trim(),
      sortOrder: Number(row.sortOrder ?? index),
    }))
    .filter((row) => row.inventoryItemId > 0 && row.quantity > 0);

exports.getMenuItems = (req, res) => {
  return withRecipeSchema(res, async () => {
    const rows = await MenuRecipeModel.listMenuItems();
    res.json(rows);
  });
};

exports.getInventoryItems = (req, res) => {
  return withRecipeSchema(res, async () => {
    const rows = await MenuRecipeModel.listInventoryItems();
    res.json(rows);
  });
};

exports.getRecipeCatalogue = (req, res) => {
  return withRecipeSchema(res, async () => {
    const rows = await MenuRecipeModel.listRecipeRows();
    res.json(rows);
  });
};

exports.getRecipeByMenuItem = (req, res) => {
  return withRecipeSchema(res, async () => {
    const rows = await MenuRecipeModel.getRecipeByMenuItem(req.params.menuItemId);
    res.json(rows);
  });
};

exports.replaceRecipe = (req, res) => {
  const rows = parseRecipeRows(req.body?.ingredients);
  if (!rows.length) {
    return res.status(400).json({ message: "At least one valid ingredient row is required." });
  }

  return withRecipeSchema(res, async () => {
    const nextRows = await MenuRecipeModel.replaceRecipe(req.params.menuItemId, rows);
    res.json({
      message: "Recipe saved successfully.",
      rows: nextRows,
    });
  });
};

exports.updateRecipeRow = (req, res) => {
  const payload = parseRecipeRows([req.body])[0];
  if (!payload) {
    return res.status(400).json({ message: "A valid recipe row payload is required." });
  }

  return withRecipeSchema(res, async () => {
    await MenuRecipeModel.updateRecipeRow(req.params.recipeRowId, payload);
    res.json({ message: "Recipe row updated." });
  });
};

exports.deleteRecipeRow = (req, res) => {
  return withRecipeSchema(res, async () => {
    await MenuRecipeModel.deleteRecipeRow(req.params.recipeRowId);
    res.json({ message: "Recipe row deleted." });
  });
};

exports.previewConsumption = (req, res) => {
  const menuItemId = Number(req.body?.menuItemId || 0);
  const orderQuantity = Number(req.body?.orderQuantity || 0);

  if (!menuItemId || orderQuantity <= 0) {
    return res.status(400).json({ message: "menuItemId and orderQuantity are required." });
  }

  return withRecipeSchema(res, async () => {
    const rows = await MenuRecipeModel.previewConsumption(menuItemId, orderQuantity);
    res.json(rows);
  });
};

exports.applyConsumption = (req, res) => {
  const menuItemId = Number(req.body?.menuItemId || 0);
  const orderQuantity = Number(req.body?.orderQuantity || 0);

  if (!menuItemId || orderQuantity <= 0) {
    return res.status(400).json({ message: "menuItemId and orderQuantity are required." });
  }

  return withRecipeSchema(res, async () => {
    const rows = await MenuRecipeModel.applyConsumption({
      menuItemId,
      orderQuantity,
      referenceType: req.body?.referenceType || "manual",
      referenceId: req.body?.referenceId || null,
      remarks: req.body?.remarks || null,
      consumedBy: req.user?.email || req.user?.username || "system",
    });

    res.json({
      message: "Consumption applied successfully.",
      rows,
    });
  });
};

exports.getConsumptionLog = (req, res) => {
  return withRecipeSchema(res, async () => {
    const rows = await MenuRecipeModel.getConsumptionLog(req.query.limit);
    res.json(rows);
  });
};
