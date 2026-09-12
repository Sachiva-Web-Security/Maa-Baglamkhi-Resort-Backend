const db = require("../config/db");
const MenuItemIngredientsModel = require("../models/MenuItemIngredientsModel");
const InventoryModel = require("../models/InventoryCategoriesModel");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });

const normalizeRecipeRow = (row, index = 0) => ({
  menuItemId: Number(row.menuItemId || row.menu_item_id || 0),
  inventoryItemId: Number(row.inventoryItemId || row.inventory_item_id || 0),
  quantity: Number(row.quantity || 0),
  unit: String(row.unit || "").trim() || null,
  wastagePercent: Number(row.wastagePercent ?? row.wastage_percent ?? 0),
  isOptional: Boolean(Number(row.isOptional ?? row.is_optional ?? 0)),
  notes: String(row.notes || "").trim() || null,
  sortOrder: Number(row.sortOrder ?? row.sort_order ?? index),
});

const computeRequiredQuantity = (recipeQuantity, orderQuantity, wastagePercent) => {
  const base = Number(recipeQuantity || 0) * Number(orderQuantity || 0);
  const multiplier = 1 + Number(wastagePercent || 0) / 100;
  return Number((base * multiplier).toFixed(3));
};

const withRecipeSchema = async (res, task) => {
  try {
    await MenuItemIngredientsModel.ensureSchema();
    await task();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to prepare menu recipe schema.",
      error,
    });
  }
};

exports.getMenuItems = async (req, res) => {
  return withRecipeSchema(res, async () => {
    const rows = await InventoryModel.findAll();
    res.json(rows);
  });
};

exports.getInventoryItems = async (req, res) => {
  return withRecipeSchema(res, async () => {
    const rows = await InventoryModel.findAll();
    res.json(rows);
  });
};

exports.getRecipeCatalogue = async (req, res) => {
  return withRecipeSchema(res, async () => {
    const [recipeRows] = await runQuery(`
      SELECT mir.id,
             mir.menu_item_id AS menuItemId,
             m.name AS menuItemName,
             mir.inventory_item_id AS inventoryItemId,
             i.name AS inventoryItemName,
             mir.quantity,
             mir.unit,
             mir.wastage_percent AS wastagePercent,
             mir.is_optional AS isOptional,
             mir.notes,
             mir.sort_order AS sortOrder
      FROM menu_item_ingredients mir
      INNER JOIN menu_items m ON m.id = mir.menu_item_id
      INNER JOIN inventory i ON i.id = mir.inventory_item_id
      ORDER BY m.name ASC, mir.sort_order ASC, i.name ASC
    `);
    res.json(recipeRows);
  });
};

exports.getRecipeByMenuItem = async (req, res) => {
  return withRecipeSchema(res, async () => {
    const [rows] = await runQuery(
      `
        SELECT mir.id,
               mir.menu_item_id AS menuItemId,
               m.name AS menuItemName,
               mir.inventory_item_id AS inventoryItemId,
               i.name AS inventoryItemName,
               i.stock AS currentStock,
               i.unit AS inventoryUnit,
               mir.quantity,
               mir.unit,
               mir.wastage_percent AS wastagePercent,
               mir.is_optional AS isOptional,
               mir.notes,
               mir.sort_order AS sortOrder
        FROM menu_item_ingredients mir
        INNER JOIN menu_items m ON m.id = mir.menu_item_id
        INNER JOIN inventory i ON i.id = mir.inventory_item_id
        WHERE mir.menu_item_id = ?
        ORDER BY mir.sort_order ASC, i.name ASC
      `,
      [req.params.menuItemId]
    );
    res.json(rows);
  });
};

exports.replaceRecipe = async (req, res) => {
  const recipeRows = (Array.isArray(req.body?.ingredients) ? req.body.ingredients : [])
    .map((row, index) => normalizeRecipeRow(row, index))
    .filter((row) => row.inventoryItemId > 0 && row.quantity > 0);

  if (!recipeRows.length) {
    return res.status(400).json({ message: "At least one valid ingredient row is required." });
  }

  return withRecipeSchema(res, async () => {
    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();
      await runQuery("DELETE FROM menu_item_ingredients WHERE menu_item_id = ?", [req.params.menuItemId], connection);

      for (let index = 0; index < recipeRows.length; index += 1) {
        const row = recipeRows[index];
        await runQuery(
          `
            INSERT INTO menu_item_ingredients
              (menu_item_id, inventory_item_id, quantity, unit, wastage_percent, is_optional, notes, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            req.params.menuItemId,
            row.inventoryItemId,
            row.quantity,
            row.unit,
            row.wastagePercent,
            row.isOptional ? 1 : 0,
            row.notes,
            row.sortOrder,
          ],
          connection,
        );
      }

      await connection.commit();
      const [nextRows] = await runQuery(
        `SELECT * FROM menu_item_ingredients WHERE menu_item_id = ? ORDER BY sort_order ASC, id ASC`,
        [req.params.menuItemId]
      );
      res.json({
        message: "Recipe saved successfully.",
        rows: nextRows,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
};

exports.updateRecipeRow = async (req, res) => {
  return withRecipeSchema(res, async () => {
    const payload = normalizeRecipeRow(req.body);
    if (!payload.inventoryItemId || !payload.quantity) {
      return res.status(400).json({ message: "A valid recipe row payload is required." });
    }

    await runQuery(
      `
        UPDATE menu_item_ingredients
        SET inventory_item_id = ?,
            quantity = ?,
            unit = ?,
            wastage_percent = ?,
            is_optional = ?,
            notes = ?,
            sort_order = ?
        WHERE id = ?
      `,
      [
        payload.inventoryItemId,
        payload.quantity,
        payload.unit,
        payload.wastagePercent,
        payload.isOptional ? 1 : 0,
        payload.notes,
        payload.sortOrder,
        req.params.recipeRowId,
      ]
    );

    res.json({ message: "Recipe row updated." });
  });
};

exports.deleteRecipeRow = async (req, res) => {
  return withRecipeSchema(res, async () => {
    await runQuery("DELETE FROM menu_item_ingredients WHERE id = ?", [req.params.recipeRowId]);
    res.json({ message: "Recipe row deleted." });
  });
};

exports.previewConsumption = async (req, res) => {
  const menuItemId = Number(req.body?.menuItemId || 0);
  const orderQuantity = Number(req.body?.orderQuantity || 0);

  if (!menuItemId || orderQuantity <= 0) {
    return res.status(400).json({ message: "menuItemId and orderQuantity are required." });
  }

  return withRecipeSchema(res, async () => {
    const [rows] = await runQuery(
      `
        SELECT mir.id,
               mir.menu_item_id AS menuItemId,
               mir.inventory_item_id AS inventoryItemId,
               i.name AS inventoryItemName,
               i.stock AS currentStock,
               i.unit AS inventoryUnit,
               mir.quantity,
               mir.unit,
               mir.wastage_percent AS wastagePercent,
               mir.is_optional AS isOptional,
               mir.notes
        FROM menu_item_ingredients mir
        INNER JOIN inventory i ON i.id = mir.inventory_item_id
        WHERE mir.menu_item_id = ?
        ORDER BY mir.sort_order ASC, i.name ASC
      `,
      [menuItemId]
    );

    res.json(
      rows.map((row) => {
        const requiredQuantity = computeRequiredQuantity(row.quantity, orderQuantity, row.wastagePercent);
        const currentStock = Number(row.currentStock || 0);
        return {
          recipeRowId: row.id,
          inventoryItemId: row.inventoryItemId,
          inventoryItemName: row.inventoryItemName,
          currentStock,
          requiredQuantity,
          remainingStock: Number((currentStock - requiredQuantity).toFixed(3)),
          unit: row.unit || row.inventoryUnit || "",
          enoughStock: currentStock >= requiredQuantity,
          isOptional: Boolean(Number(row.isOptional || 0)),
          notes: row.notes || null,
        };
      })
    );
  });
};

exports.applyConsumption = async (req, res) => {
  const menuItemId = Number(req.body?.menuItemId || 0);
  const orderQuantity = Number(req.body?.orderQuantity || 0);

  if (!menuItemId || orderQuantity <= 0) {
    return res.status(400).json({ message: "menuItemId and orderQuantity are required." });
  }

  return withRecipeSchema(res, async () => {
    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await runQuery(
        `
          SELECT mir.id,
                 mir.inventory_item_id AS inventoryItemId,
                 mir.quantity,
                 mir.unit,
                 mir.wastage_percent AS wastagePercent,
                 i.name AS inventoryItemName,
                 i.stock AS currentStock,
                 i.unit AS inventoryUnit
          FROM menu_item_ingredients mir
          INNER JOIN inventory i ON i.id = mir.inventory_item_id
          WHERE mir.menu_item_id = ?
          ORDER BY mir.sort_order ASC, i.name ASC
          FOR UPDATE
        `,
        [menuItemId],
        connection
      );

      if (!rows.length) {
        const error = new Error("No recipe rows found for this menu item.");
        error.statusCode = 404;
        throw error;
      }

      const results = [];
      for (const row of rows) {
        const requiredQuantity = computeRequiredQuantity(row.quantity, orderQuantity, row.wastagePercent);
        const currentStock = Number(row.currentStock || 0);

        if (currentStock < requiredQuantity) {
          const error = new Error(
            `Insufficient stock for ${row.inventoryItemName}. Required ${requiredQuantity}, available ${currentStock}.`
          );
          error.statusCode = 400;
          throw error;
        }

        await runQuery("UPDATE inventory SET stock = stock - ? WHERE id = ?", [requiredQuantity, row.inventoryItemId], connection);

        await runQuery(
          `
            INSERT INTO inventory_consumption_log
              (menu_item_id, inventory_item_id, recipe_row_id, order_quantity, consumed_quantity, unit, reference_type, reference_id, remarks, consumed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            menuItemId,
            row.inventoryItemId,
            row.id,
            Number(orderQuantity || 0),
            requiredQuantity,
            row.unit || row.inventoryUnit || null,
            req.body?.referenceType || "manual",
            req.body?.referenceId || null,
            req.body?.remarks || null,
            req.user?.email || req.user?.username || "system",
          ],
          connection
        );

        results.push({
          recipeRowId: row.id,
          inventoryItemId: row.inventoryItemId,
          inventoryItemName: row.inventoryItemName,
          consumedQuantity: requiredQuantity,
          remainingStock: Number((currentStock - requiredQuantity).toFixed(3)),
          unit: row.unit || row.inventoryUnit || "",
        });
      }

      await connection.commit();
      res.json({
        message: "Consumption applied successfully.",
        rows: results,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
};

exports.getConsumptionLog = async (req, res) => {
  return withRecipeSchema(res, async () => {
    const limit = Number(req.query.limit || 100);
    const [rows] = await runQuery(
      `
        SELECT icl.id,
               icl.menu_item_id AS menuItemId,
               m.name AS menuItemName,
               icl.inventory_item_id AS inventoryItemId,
               i.name AS inventoryItemName,
               icl.order_quantity AS orderQuantity,
               icl.consumed_quantity AS consumedQuantity,
               icl.unit,
               icl.reference_type AS referenceType,
               icl.reference_id AS referenceId,
               icl.remarks,
               icl.consumed_by AS consumedBy,
               icl.consumed_at AS consumedAt
        FROM inventory_consumption_log icl
        INNER JOIN menu_items m ON m.id = icl.menu_item_id
        INNER JOIN inventory i ON i.id = icl.inventory_item_id
        ORDER BY icl.consumed_at DESC, icl.id DESC
        LIMIT ?
      `,
      [limit]
    );
    res.json(rows);
  });
};
