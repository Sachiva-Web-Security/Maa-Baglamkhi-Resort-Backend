const db = require("../config/db");
const InventoryModel = require("./InventoryModel");
const RestaurantModel = require("./RestaurantModel");

const query = (sql, params = [], connection = null) => {
  const executor = connection || db.promise();
  return executor.query(sql, params).then(([rows]) => rows);
};

const ensureSchema = async () => {
  await InventoryModel.ensureSchema();
  await RestaurantModel.ensureSchema();

  await query(`
    CREATE TABLE IF NOT EXISTS menu_item_ingredients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      menu_item_id INT NOT NULL,
      inventory_item_id INT NOT NULL,
      quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
      unit VARCHAR(60) NULL,
      wastage_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      is_optional TINYINT(1) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_menu_recipe_item (menu_item_id, inventory_item_id),
      KEY idx_menu_recipe_menu (menu_item_id),
      KEY idx_menu_recipe_inventory (inventory_item_id),
      CONSTRAINT fk_menu_recipe_menu_item
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_menu_recipe_inventory_item
        FOREIGN KEY (inventory_item_id) REFERENCES inventory(id)
        ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS inventory_consumption_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      menu_item_id INT NOT NULL,
      inventory_item_id INT NOT NULL,
      recipe_row_id INT NULL,
      order_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
      consumed_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
      unit VARCHAR(60) NULL,
      reference_type VARCHAR(80) NOT NULL DEFAULT 'manual',
      reference_id VARCHAR(120) NULL,
      remarks TEXT NULL,
      consumed_by VARCHAR(120) NULL,
      consumed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_consumption_menu (menu_item_id),
      KEY idx_consumption_inventory (inventory_item_id),
      KEY idx_consumption_reference (reference_type, reference_id),
      CONSTRAINT fk_consumption_menu_item
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_consumption_inventory_item
        FOREIGN KEY (inventory_item_id) REFERENCES inventory(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_consumption_recipe_row
        FOREIGN KEY (recipe_row_id) REFERENCES menu_item_ingredients(id)
        ON DELETE SET NULL
    )
  `);
};

const normalizeRecipeRow = (row, index = 0) => ({
  id: row.id,
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

const MenuRecipeModel = {
  ensureSchema,

  async listMenuItems() {
    return query(`
      SELECT id,
             name,
             category,
             price,
             COALESCE(availability_status, status, 'Available') AS status
      FROM menu_items
      ORDER BY category ASC, name ASC
    `);
  },

  async listInventoryItems() {
    return query(`
      SELECT id,
             name,
             category,
             stock,
             unit,
             price,
             reorder_point AS reorderPoint,
             branch
      FROM inventory
      ORDER BY name ASC
    `);
  },

  async listRecipeRows() {
    return query(`
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
  },

  async getRecipeByMenuItem(menuItemId) {
    return query(
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
      [menuItemId],
    );
  },

  async replaceRecipe(menuItemId, recipeRows) {
    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();
      await query("DELETE FROM menu_item_ingredients WHERE menu_item_id = ?", [menuItemId], connection);

      for (let index = 0; index < recipeRows.length; index += 1) {
        const row = normalizeRecipeRow(recipeRows[index], index);
        await query(
          `
            INSERT INTO menu_item_ingredients
              (menu_item_id, inventory_item_id, quantity, unit, wastage_percent, is_optional, notes, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            menuItemId,
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
      return this.getRecipeByMenuItem(menuItemId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async updateRecipeRow(recipeRowId, payload) {
    const row = normalizeRecipeRow(payload);
    await query(
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
        row.inventoryItemId,
        row.quantity,
        row.unit,
        row.wastagePercent,
        row.isOptional ? 1 : 0,
        row.notes,
        row.sortOrder,
        recipeRowId,
      ],
    );
  },

  async deleteRecipeRow(recipeRowId) {
    await query("DELETE FROM menu_item_ingredients WHERE id = ?", [recipeRowId]);
  },

  async previewConsumption(menuItemId, orderQuantity) {
    const rows = await query(
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
      [menuItemId],
    );

    return rows.map((row) => {
      const requiredQuantity = computeRequiredQuantity(
        row.quantity,
        orderQuantity,
        row.wastagePercent,
      );
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
    });
  },

  async applyConsumption({
    menuItemId,
    orderQuantity,
    referenceType = "manual",
    referenceId = null,
    remarks = null,
    consumedBy = "system",
  }) {
    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();

      const rows = await query(
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
        connection,
      );

      if (!rows.length) {
        const error = new Error("No recipe rows found for this menu item.");
        error.statusCode = 404;
        throw error;
      }

      const results = [];
      for (const row of rows) {
        const requiredQuantity = computeRequiredQuantity(
          row.quantity,
          orderQuantity,
          row.wastagePercent,
        );
        const currentStock = Number(row.currentStock || 0);

        if (currentStock < requiredQuantity) {
          const error = new Error(
            `Insufficient stock for ${row.inventoryItemName}. Required ${requiredQuantity}, available ${currentStock}.`,
          );
          error.statusCode = 400;
          throw error;
        }

        await query(
          "UPDATE inventory SET stock = stock - ? WHERE id = ?",
          [requiredQuantity, row.inventoryItemId],
          connection,
        );

        await query(
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
            referenceType,
            referenceId,
            remarks,
            consumedBy,
          ],
          connection,
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
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async getConsumptionLog(limit = 100) {
    return query(
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
      [Number(limit || 100)],
    );
  },
};

module.exports = MenuRecipeModel;
