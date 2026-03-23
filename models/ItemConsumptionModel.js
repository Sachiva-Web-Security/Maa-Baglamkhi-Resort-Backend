const db = require("../config/db");

const connection = db.promise();

const UNIT_FACTORS = {
  gm: { baseUnit: "gm", factor: 1, dimension: "weight" },
  kg: { baseUnit: "gm", factor: 1000, dimension: "weight" },
  ml: { baseUnit: "ml", factor: 1, dimension: "volume" },
  liter: { baseUnit: "ml", factor: 1000, dimension: "volume" },
  ltr: { baseUnit: "ml", factor: 1000, dimension: "volume" },
  pcs: { baseUnit: "pcs", factor: 1, dimension: "count" },
  pc: { baseUnit: "pcs", factor: 1, dimension: "count" },
};

const normalizeUnit = (unit) => String(unit || "pcs").trim().toLowerCase();

const toBaseUnit = (quantity, unit) => {
  const meta = UNIT_FACTORS[normalizeUnit(unit)] || UNIT_FACTORS.pcs;
  return {
    quantity: Number(quantity || 0) * meta.factor,
    baseUnit: meta.baseUnit,
    dimension: meta.dimension,
  };
};

const fromBaseUnit = (quantity, unit) => {
  const meta = UNIT_FACTORS[normalizeUnit(unit)] || UNIT_FACTORS.pcs;
  return Number(quantity || 0) / meta.factor;
};

const run = (sql, params = []) => connection.query(sql, params);

const ensureSchema = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      unit VARCHAR(30) NOT NULL DEFAULT 'gm',
      cost_per_base_unit DECIMAL(12,4) NOT NULL DEFAULT 0,
      branch VARCHAR(120) DEFAULT 'Main Branch',
      outlet VARCHAR(120) DEFAULT 'Main Kitchen',
      opening_stock_base DECIMAL(14,3) NOT NULL DEFAULT 0,
      reorder_level_base DECIMAL(14,3) NOT NULL DEFAULT 0,
      created_by VARCHAR(120) DEFAULT 'system',
      updated_by VARCHAR(120) DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ingredient_name_branch_outlet (name, branch, outlet)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS stock_inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ingredient_id INT NOT NULL,
      outlet VARCHAR(120) DEFAULT 'Main Kitchen',
      branch VARCHAR(120) DEFAULT 'Main Branch',
      stock_base_qty DECIMAL(14,3) NOT NULL DEFAULT 0,
      reserved_base_qty DECIMAL(14,3) NOT NULL DEFAULT 0,
      wastage_base_qty DECIMAL(14,3) NOT NULL DEFAULT 0,
      avg_cost_per_base_unit DECIMAL(12,4) NOT NULL DEFAULT 0,
      updated_by VARCHAR(120) DEFAULT 'system',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_stock_inventory_ingredient
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
      ON DELETE CASCADE,
      UNIQUE KEY uq_stock_inventory_ingredient_outlet_branch (ingredient_id, outlet, branch)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS recipe_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      menu_item_id INT NOT NULL,
      version_label VARCHAR(80) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      notes TEXT,
      created_by VARCHAR(120) DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_recipe_versions_menu_item
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
      ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS item_recipes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recipe_version_id INT NOT NULL,
      menu_item_id INT NOT NULL,
      ingredient_id INT NOT NULL,
      quantity_per_item DECIMAL(12,3) NOT NULL DEFAULT 0,
      unit VARCHAR(30) NOT NULL DEFAULT 'gm',
      quantity_per_item_base DECIMAL(14,3) NOT NULL DEFAULT 0,
      base_unit VARCHAR(30) NOT NULL DEFAULT 'gm',
      wastage_percent DECIMAL(8,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_item_recipes_recipe_version
      FOREIGN KEY (recipe_version_id) REFERENCES recipe_versions(id)
      ON DELETE CASCADE,
      CONSTRAINT fk_item_recipes_menu_item
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
      ON DELETE CASCADE,
      CONSTRAINT fk_item_recipes_ingredient
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
      ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sales_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_order_id INT DEFAULT NULL,
      source_bill_id INT DEFAULT NULL,
      reference_no VARCHAR(120) DEFAULT NULL,
      reference_type VARCHAR(60) DEFAULT 'restaurant',
      outlet VARCHAR(120) DEFAULT 'Main Kitchen',
      branch VARCHAR(120) DEFAULT 'Main Branch',
      entity_type VARCHAR(60) DEFAULT 'Table',
      entity_ref VARCHAR(120) DEFAULT NULL,
      status VARCHAR(40) DEFAULT 'completed',
      subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
      tax DECIMAL(12,2) NOT NULL DEFAULT 0,
      total DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_by VARCHAR(120) DEFAULT 'system',
      updated_by VARCHAR(120) DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_sales_orders_reference (reference_type, reference_no)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sales_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sales_order_id INT NOT NULL,
      menu_item_id INT DEFAULT NULL,
      menu_item_name VARCHAR(191) NOT NULL,
      category VARCHAR(120) DEFAULT 'Other',
      quantity_sold DECIMAL(12,3) NOT NULL DEFAULT 0,
      rate DECIMAL(12,2) NOT NULL DEFAULT 0,
      line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sales_order_items_order
      FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id)
      ON DELETE CASCADE,
      CONSTRAINT fk_sales_order_items_menu
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
      ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS item_consumption_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_order_id INT NOT NULL,
      sale_order_item_id INT NOT NULL,
      recipe_version_id INT DEFAULT NULL,
      ingredient_id INT NOT NULL,
      log_type VARCHAR(40) DEFAULT 'sale',
      consumption_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      bill_no VARCHAR(120) DEFAULT NULL,
      menu_item_name VARCHAR(191) NOT NULL,
      category VARCHAR(120) DEFAULT 'Other',
      quantity_sold DECIMAL(12,3) NOT NULL DEFAULT 0,
      ingredient_name VARCHAR(191) NOT NULL,
      per_item_consumption DECIMAL(12,3) NOT NULL DEFAULT 0,
      total_consumption DECIMAL(12,3) NOT NULL DEFAULT 0,
      unit VARCHAR(30) NOT NULL DEFAULT 'gm',
      ingredient_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
      total_consumption_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
      opening_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
      consumed_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
      remaining_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
      outlet VARCHAR(120) DEFAULT 'Main Kitchen',
      branch VARCHAR(120) DEFAULT 'Main Branch',
      created_by VARCHAR(120) DEFAULT 'system',
      updated_by VARCHAR(120) DEFAULT 'system',
      notes TEXT,
      CONSTRAINT fk_item_consumption_logs_sale
      FOREIGN KEY (sale_order_id) REFERENCES sales_orders(id)
      ON DELETE CASCADE,
      CONSTRAINT fk_item_consumption_logs_sale_item
      FOREIGN KEY (sale_order_item_id) REFERENCES sales_order_items(id)
      ON DELETE CASCADE,
      CONSTRAINT fk_item_consumption_logs_ingredient
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
      ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ingredient_id INT NOT NULL,
      adjustment_type VARCHAR(40) DEFAULT 'manual',
      quantity_base DECIMAL(12,3) NOT NULL DEFAULT 0,
      unit VARCHAR(30) NOT NULL DEFAULT 'gm',
      reason TEXT,
      outlet VARCHAR(120) DEFAULT 'Main Kitchen',
      branch VARCHAR(120) DEFAULT 'Main Branch',
      created_by VARCHAR(120) DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_stock_adjustments_ingredient
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
      ON DELETE CASCADE
    )
  `);
};

const findMenuItem = async ({ menuItemId, name }) => {
  if (menuItemId) {
    const [rows] = await run(`SELECT * FROM menu_items WHERE id=? LIMIT 1`, [menuItemId]);
    return rows[0] || null;
  }

  const [rows] = await run(
    `SELECT * FROM menu_items WHERE LOWER(name)=LOWER(?) ORDER BY id DESC LIMIT 1`,
    [String(name || "").trim()],
  );
  return rows[0] || null;
};

const ensureIngredientStock = async ({
  ingredientId,
  outlet = "Main Kitchen",
  branch = "Main Branch",
  updatedBy = "system",
}) => {
  const [stockRows] = await run(
    `SELECT * FROM stock_inventory WHERE ingredient_id=? AND outlet=? AND branch=? LIMIT 1`,
    [ingredientId, outlet, branch],
  );

  if (stockRows[0]) return stockRows[0];

  const [ingredientRows] = await run(`SELECT * FROM ingredients WHERE id=? LIMIT 1`, [ingredientId]);
  const ingredient = ingredientRows[0];

  await run(
    `INSERT INTO stock_inventory (ingredient_id, outlet, branch, stock_base_qty, avg_cost_per_base_unit, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      ingredientId,
      outlet,
      branch,
      Number(ingredient?.opening_stock_base || 0),
      Number(ingredient?.cost_per_base_unit || 0),
      updatedBy,
    ],
  );

  const [freshRows] = await run(
    `SELECT * FROM stock_inventory WHERE ingredient_id=? AND outlet=? AND branch=? LIMIT 1`,
    [ingredientId, outlet, branch],
  );
  return freshRows[0];
};

const getActiveRecipeByItem = async (menuItemId) => {
  const [rows] = await run(
    `
      SELECT
        ir.*,
        rv.version_label,
        i.name AS ingredient_name,
        i.cost_per_base_unit,
        i.unit AS ingredient_unit,
        i.branch,
        i.outlet
      FROM recipe_versions rv
      INNER JOIN item_recipes ir ON ir.recipe_version_id = rv.id
      INNER JOIN ingredients i ON i.id = ir.ingredient_id
      WHERE rv.menu_item_id=? AND rv.is_active=1
      ORDER BY ir.id ASC
    `,
    [menuItemId],
  );
  return rows;
};

const getFallbackConsumptionRows = async (filters = {}) => {
  const [menuRows] = await run(`SELECT id, name, category FROM menu_items`);
  const menuMap = new Map(
    menuRows.map((row) => [String(row.name || "").trim().toLowerCase(), row]),
  );
  const [kitchenRows] = await run(`SELECT * FROM kitchen_orders ORDER BY id DESC`);

  const rows = [];

  kitchenRows.forEach((order) => {
    const orderDate = new Date(order.created_at);
    if (filters.dateFrom && new Date(filters.dateFrom) > orderDate) return;
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      if (orderDate > end) return;
    }

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(order.items || "[]");
    } catch (error) {
      parsedItems = [];
    }

    parsedItems.forEach((item, index) => {
      const name = item.name || item.item_name || "Unnamed Item";
      const menuItem = menuMap.get(String(name).trim().toLowerCase());
      const category = menuItem?.category || "Other";
      const soldQty = Number(item.quantity ?? item.qty ?? 0) || 0;
      const soldRate = Number(item.price ?? item.rate ?? menuItem?.price ?? 0) || 0;
      const soldAmount = soldQty * soldRate;

      if (filters.itemName && !String(name).toLowerCase().includes(String(filters.itemName).toLowerCase())) {
        return;
      }
      if (filters.category && String(category) !== String(filters.category)) {
        return;
      }
      if (filters.outlet && String(filters.outlet) !== "Main Kitchen") {
        return;
      }

      rows.push({
        id: `fallback-${order.id}-${index}`,
        date: order.created_at,
        bill_no: `KOT-${order.id}`,
        sale_order_id: null,
        menu_item_name: name,
        category,
        quantity_sold: soldQty,
        ingredient_name: "Recipe not mapped",
        per_item_consumption: soldRate,
        total_consumption: soldQty,
        unit: "item",
        ingredient_cost: soldRate,
        total_consumption_cost: soldAmount,
        opening_stock: 0,
        consumed_stock: soldQty,
        remaining_stock: 0,
        outlet: "Main Kitchen",
        branch: "Main Branch",
        created_by: order.waiter_name || "system",
        updated_by: order.waiter_name || "system",
      });
    });
  });

  return rows;
};

const upsertIngredient = async (payload) => {
  const base = toBaseUnit(payload.openingStock || 0, payload.unit);
  const [result] = await run(
    `
      INSERT INTO ingredients
      (name, unit, cost_per_base_unit, branch, outlet, opening_stock_base, reorder_level_base, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      unit=VALUES(unit),
      cost_per_base_unit=VALUES(cost_per_base_unit),
      branch=VALUES(branch),
      outlet=VALUES(outlet),
      opening_stock_base=VALUES(opening_stock_base),
      reorder_level_base=VALUES(reorder_level_base),
      updated_by=VALUES(updated_by)
    `,
    [
      payload.name,
      normalizeUnit(payload.unit),
      Number(payload.costPerUnit || 0) / (UNIT_FACTORS[normalizeUnit(payload.unit)]?.factor || 1),
      payload.branch || "Main Branch",
      payload.outlet || "Main Kitchen",
      base.quantity,
      toBaseUnit(payload.reorderLevel || 0, payload.unit).quantity,
      payload.createdBy || "system",
      payload.updatedBy || payload.createdBy || "system",
    ],
  );

  const [rows] = await run(
    `SELECT * FROM ingredients WHERE name=? AND branch=? AND outlet=? LIMIT 1`,
    [payload.name, payload.branch || "Main Branch", payload.outlet || "Main Kitchen"],
  );

  const ingredient = rows[0];
  await ensureIngredientStock({
    ingredientId: ingredient.id,
    outlet: ingredient.outlet,
    branch: ingredient.branch,
    updatedBy: payload.updatedBy || payload.createdBy || "system",
  });

  return { id: ingredient.id, affectedRows: result.affectedRows };
};

const getIngredients = async () => {
  const [rows] = await run(
    `
      SELECT
        i.*,
        si.stock_base_qty,
        si.wastage_base_qty,
        si.avg_cost_per_base_unit
      FROM ingredients i
      LEFT JOIN stock_inventory si
        ON si.ingredient_id = i.id
        AND si.outlet = i.outlet
        AND si.branch = i.branch
      ORDER BY i.name ASC
    `,
  );
  return rows.map((row) => ({
    ...row,
    openingStock: fromBaseUnit(row.opening_stock_base, row.unit),
    currentStock: fromBaseUnit(row.stock_base_qty, row.unit),
    wastageQty: fromBaseUnit(row.wastage_base_qty, row.unit),
    costPerUnit: Number(row.cost_per_base_unit || 0) * (UNIT_FACTORS[normalizeUnit(row.unit)]?.factor || 1),
  }));
};

const createOrUpdateRecipe = async ({
  menuItemId,
  versionLabel,
  notes,
  lines = [],
  createdBy = "system",
}) => {
  const menuItem = await findMenuItem({ menuItemId });
  if (!menuItem) {
    throw new Error("Menu item not found");
  }

  await connection.beginTransaction();
  try {
    await connection.query(`UPDATE recipe_versions SET is_active=0 WHERE menu_item_id=?`, [menuItem.id]);

    const [versionResult] = await connection.query(
      `INSERT INTO recipe_versions (menu_item_id, version_label, is_active, notes, created_by) VALUES (?, ?, 1, ?, ?)`,
      [menuItem.id, versionLabel || `v${Date.now()}`, notes || null, createdBy],
    );

    for (const line of lines) {
      const base = toBaseUnit(line.quantityPerItem, line.unit);
      await ensureIngredientStock({
        ingredientId: Number(line.ingredientId),
        outlet: line.outlet || "Main Kitchen",
        branch: line.branch || "Main Branch",
        updatedBy: createdBy,
      });

      await connection.query(
        `
          INSERT INTO item_recipes
          (recipe_version_id, menu_item_id, ingredient_id, quantity_per_item, unit, quantity_per_item_base, base_unit, wastage_percent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          versionResult.insertId,
          menuItem.id,
          Number(line.ingredientId),
          Number(line.quantityPerItem || 0),
          normalizeUnit(line.unit),
          base.quantity,
          base.baseUnit,
          Number(line.wastagePercent || 0),
        ],
      );
    }

    await connection.commit();
    return {
      recipeVersionId: versionResult.insertId,
      menuItemId: menuItem.id,
      message: "Recipe saved successfully",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
};

const getRecipeByItem = async (menuItemId) => {
  const menuItem = await findMenuItem({ menuItemId });
  if (!menuItem) return null;
  const recipeLines = await getActiveRecipeByItem(menuItem.id);
  return {
    menuItem,
    lines: recipeLines,
  };
};

const createSaleWithConsumption = async ({
  referenceNo,
  referenceType = "restaurant",
  sourceBillId = null,
  sourceOrderId = null,
  outlet = "Main Kitchen",
  branch = "Main Branch",
  entityType = "Table",
  entityRef = null,
  subtotal = 0,
  tax = 0,
  total = 0,
  createdBy = "system",
  items = [],
}) => {
  if (!items.length) {
    throw new Error("Sale items are required");
  }

  const [existingRows] = await run(
    `SELECT * FROM sales_orders WHERE reference_type=? AND reference_no=? LIMIT 1`,
    [referenceType, referenceNo],
  );
  if (existingRows[0]) {
    return {
      saleOrderId: existingRows[0].id,
      duplicated: true,
      message: "Consumption already generated for this sale reference",
    };
  }

  await connection.beginTransaction();
  try {
    const [saleResult] = await connection.query(
      `
        INSERT INTO sales_orders
        (source_order_id, source_bill_id, reference_no, reference_type, outlet, branch, entity_type, entity_ref, status, subtotal, tax, total, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)
      `,
      [
        sourceOrderId,
        sourceBillId,
        referenceNo,
        referenceType,
        outlet,
        branch,
        entityType,
        entityRef,
        Number(subtotal || 0),
        Number(tax || 0),
        Number(total || 0),
        createdBy,
        createdBy,
      ],
    );

    const saleOrderId = saleResult.insertId;
    const logs = [];

    for (const item of items) {
      const menuItem = await findMenuItem({
        menuItemId: item.menuItemId,
        name: item.name,
      });

      const [saleItemResult] = await connection.query(
        `
          INSERT INTO sales_order_items
          (sales_order_id, menu_item_id, menu_item_name, category, quantity_sold, rate, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          saleOrderId,
          menuItem?.id || null,
          item.name,
          item.category || menuItem?.category || "Other",
          Number(item.quantity || item.qty || 0),
          Number(item.price || item.rate || 0),
          Number(item.quantity || item.qty || 0) * Number(item.price || item.rate || 0),
        ],
      );

      const saleOrderItemId = saleItemResult.insertId;
      if (!menuItem?.id) continue;

      const recipeLines = await getActiveRecipeByItem(menuItem.id);
      if (!recipeLines.length) continue;

      for (const recipe of recipeLines) {
        const soldQty = Number(item.quantity || item.qty || 0);
        const extraWastage = recipe.quantity_per_item_base * (Number(recipe.wastage_percent || 0) / 100);
        const totalBaseConsumption = soldQty * (Number(recipe.quantity_per_item_base || 0) + extraWastage);

        const stock = await ensureIngredientStock({
          ingredientId: recipe.ingredient_id,
          outlet,
          branch,
          updatedBy: createdBy,
        });

        const openingStock = Number(stock.stock_base_qty || 0);
        if (openingStock < totalBaseConsumption) {
          throw new Error(`Insufficient stock for ingredient ${recipe.ingredient_name}`);
        }

        const remainingStock = openingStock - totalBaseConsumption;
        await connection.query(
          `
            UPDATE stock_inventory
            SET stock_base_qty=?, updated_by=?
            WHERE id=?
          `,
          [remainingStock, createdBy, stock.id],
        );

        const perItemDisplayQty = fromBaseUnit(recipe.quantity_per_item_base, recipe.unit);
        const totalDisplayQty = fromBaseUnit(totalBaseConsumption, recipe.unit);
        const ingredientCost = Number(recipe.cost_per_base_unit || 0);
        const totalConsumptionCost = totalBaseConsumption * ingredientCost;

        const [logResult] = await connection.query(
          `
            INSERT INTO item_consumption_logs
            (sale_order_id, sale_order_item_id, recipe_version_id, ingredient_id, log_type, bill_no, menu_item_name, category, quantity_sold, ingredient_name, per_item_consumption, total_consumption, unit, ingredient_cost, total_consumption_cost, opening_stock, consumed_stock, remaining_stock, outlet, branch, created_by, updated_by)
            VALUES (?, ?, ?, ?, 'sale', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            saleOrderId,
            saleOrderItemId,
            recipe.recipe_version_id,
            recipe.ingredient_id,
            referenceNo,
            item.name,
            item.category || menuItem.category || "Other",
            soldQty,
            recipe.ingredient_name,
            perItemDisplayQty,
            totalDisplayQty,
            recipe.unit,
            ingredientCost,
            totalConsumptionCost,
            fromBaseUnit(openingStock, recipe.unit),
            totalDisplayQty,
            fromBaseUnit(remainingStock, recipe.unit),
            outlet,
            branch,
            createdBy,
            createdBy,
          ],
        );

        logs.push({ id: logResult.insertId, ingredientName: recipe.ingredient_name });
      }
    }

    await connection.commit();
    return {
      saleOrderId,
      logsGenerated: logs.length,
      message: "Sale consumption generated successfully",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
};

const reverseSaleConsumption = async ({ saleOrderId, updatedBy = "system", notes = "Sale cancelled" }) => {
  await connection.beginTransaction();
  try {
    const [logRows] = await connection.query(
      `SELECT * FROM item_consumption_logs WHERE sale_order_id=? ORDER BY id DESC`,
      [saleOrderId],
    );

    for (const log of logRows) {
      const [ingredientRows] = await connection.query(`SELECT unit FROM ingredients WHERE id=?`, [log.ingredient_id]);
      const ingredientUnit = ingredientRows[0]?.unit || log.unit;
      const stock = await ensureIngredientStock({
        ingredientId: log.ingredient_id,
        outlet: log.outlet,
        branch: log.branch,
        updatedBy,
      });
      const baseReturnQty = toBaseUnit(log.total_consumption, ingredientUnit).quantity;
      await connection.query(
        `UPDATE stock_inventory SET stock_base_qty = stock_base_qty + ?, updated_by=? WHERE id=?`,
        [baseReturnQty, updatedBy, stock.id],
      );
    }

    await connection.query(
      `UPDATE sales_orders SET status='cancelled', updated_by=? WHERE id=?`,
      [updatedBy, saleOrderId],
    );

    await connection.query(
      `UPDATE item_consumption_logs SET log_type='reversed', updated_by=?, notes=? WHERE sale_order_id=?`,
      [updatedBy, notes, saleOrderId],
    );

    await connection.commit();
    return { message: "Consumption reversed successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
};

const getConsumptionReport = async (filters = {}) => {
  const where = [`icl.log_type='sale'`];
  const params = [];

  if (filters.dateFrom) {
    where.push(`DATE(icl.consumption_date) >= ?`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    where.push(`DATE(icl.consumption_date) <= ?`);
    params.push(filters.dateTo);
  }
  if (filters.itemName) {
    where.push(`icl.menu_item_name LIKE ?`);
    params.push(`%${filters.itemName}%`);
  }
  if (filters.ingredientName) {
    where.push(`icl.ingredient_name LIKE ?`);
    params.push(`%${filters.ingredientName}%`);
  }
  if (filters.category) {
    where.push(`icl.category = ?`);
    params.push(filters.category);
  }
  if (filters.outlet) {
    where.push(`icl.outlet = ?`);
    params.push(filters.outlet);
  }

  const [rows] = await run(
    `
      SELECT
        icl.id,
        icl.consumption_date AS date,
        icl.bill_no,
        icl.sale_order_id,
        icl.menu_item_name,
        icl.category,
        icl.quantity_sold,
        icl.ingredient_name,
        icl.per_item_consumption,
        icl.total_consumption,
        icl.unit,
        icl.ingredient_cost,
        icl.total_consumption_cost,
        icl.opening_stock,
        icl.consumed_stock,
        icl.remaining_stock,
        icl.outlet,
        icl.branch,
        icl.created_by,
        icl.updated_by
      FROM item_consumption_logs icl
      WHERE ${where.join(" AND ")}
      ORDER BY icl.consumption_date DESC, icl.id DESC
    `,
    params,
  );

  if (rows.length) return rows;
  return getFallbackConsumptionRows(filters);
};

const getIngredientConsumptionSummary = async (filters = {}) => {
  const where = [`icl.log_type='sale'`];
  const params = [];
  if (filters.dateFrom) {
    where.push(`DATE(icl.consumption_date) >= ?`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    where.push(`DATE(icl.consumption_date) <= ?`);
    params.push(filters.dateTo);
  }
  if (filters.outlet) {
    where.push(`icl.outlet = ?`);
    params.push(filters.outlet);
  }

  const [rows] = await run(
    `
      SELECT
        ingredient_name,
        unit,
        SUM(total_consumption) AS total_consumption,
        SUM(total_consumption_cost) AS total_cost,
        SUM(consumed_stock) AS consumed_stock,
        MIN(remaining_stock) AS lowest_remaining_stock
      FROM item_consumption_logs icl
      WHERE ${where.join(" AND ")}
      GROUP BY ingredient_name, unit
      ORDER BY total_consumption DESC
    `,
    params,
  );
  if (rows.length) return rows;

  const fallbackRows = await getFallbackConsumptionRows(filters);
  const map = new Map();
  fallbackRows.forEach((row) => {
    const key = row.menu_item_name;
    if (!map.has(key)) {
      map.set(key, {
        ingredient_name: `${key} (recipe pending)`,
        unit: "-",
        total_consumption: 0,
        total_cost: 0,
        consumed_stock: 0,
        lowest_remaining_stock: 0,
      });
    }
    const current = map.get(key);
    current.total_consumption += Number(row.quantity_sold || 0);
  });
  return Array.from(map.values());
};

const getStockImpactView = async (filters = {}) => {
  const params = [];
  const where = [];
  if (filters.outlet) {
    where.push(`si.outlet=?`);
    params.push(filters.outlet);
  }
  const [rows] = await run(
    `
      SELECT
        i.id,
        i.name,
        i.unit,
        i.branch,
        i.outlet,
        i.reorder_level_base,
        si.stock_base_qty,
        si.wastage_base_qty,
        si.avg_cost_per_base_unit,
        CASE
          WHEN si.stock_base_qty <= i.reorder_level_base THEN 1
          ELSE 0
        END AS is_low_stock
      FROM ingredients i
      LEFT JOIN stock_inventory si
        ON si.ingredient_id = i.id
        AND si.outlet = i.outlet
        AND si.branch = i.branch
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY is_low_stock DESC, i.name ASC
    `,
    params,
  );

  return rows.map((row) => ({
    ...row,
    currentStock: fromBaseUnit(row.stock_base_qty, row.unit),
    reorderLevel: fromBaseUnit(row.reorder_level_base, row.unit),
    wastageQty: fromBaseUnit(row.wastage_base_qty, row.unit),
  }));
};

const getDashboardSummary = async (filters = {}) => {
  const reportRows = await getConsumptionReport(filters);
  const stockImpact = await getStockImpactView(filters);
  const totalItemsSold = reportRows.reduce((sum, row) => sum + Number(row.quantity_sold || 0), 0);
  const totalIngredientsConsumed = reportRows.reduce((sum, row) => {
    const value = Number(row.total_consumption || 0);
    if (value > 0) return sum + value;
    return sum + Number(row.quantity_sold || 0);
  }, 0);
  const totalConsumptionCost = reportRows.reduce((sum, row) => {
    const exactCost = Number(row.total_consumption_cost || 0);
    if (exactCost > 0) return sum + exactCost;
    return sum + Number(row.quantity_sold || 0) * Number(row.ingredient_cost || row.per_item_consumption || 0);
  }, 0);
  const lowStockAffectedItems = stockImpact.filter((row) => Number(row.is_low_stock) === 1).length;
  const wastageQty = stockImpact.reduce((sum, row) => sum + Number(row.wastageQty || 0), 0);

  return {
    totalItemsSold,
    totalIngredientsConsumed,
    totalConsumptionCost,
    lowStockAffectedItems,
    wastageQty,
  };
};

const reconcileStock = async ({ ingredientId, actualStock, unit, updatedBy = "system", reason = "Reconciled" }) => {
  const [ingredientRows] = await run(`SELECT * FROM ingredients WHERE id=? LIMIT 1`, [ingredientId]);
  const ingredient = ingredientRows[0];
  if (!ingredient) {
    throw new Error("Ingredient not found");
  }

  const stock = await ensureIngredientStock({
    ingredientId,
    outlet: ingredient.outlet,
    branch: ingredient.branch,
    updatedBy,
  });

  const actualBase = toBaseUnit(actualStock, unit || ingredient.unit).quantity;
  const adjustmentQty = actualBase - Number(stock.stock_base_qty || 0);

  await run(
    `UPDATE stock_inventory SET stock_base_qty=?, updated_by=? WHERE id=?`,
    [actualBase, updatedBy, stock.id],
  );
  await run(
    `INSERT INTO stock_adjustments (ingredient_id, adjustment_type, quantity_base, unit, reason, outlet, branch, created_by)
     VALUES (?, 'reconciliation', ?, ?, ?, ?, ?, ?)`,
    [ingredientId, adjustmentQty, ingredient.unit, reason, ingredient.outlet, ingredient.branch, updatedBy],
  );

  return {
    ingredientId,
    adjustmentQty: fromBaseUnit(adjustmentQty, ingredient.unit),
    message: "Stock reconciled successfully",
  };
};

const getBootstrapData = async () => {
  const [menuItems] = await run(`SELECT id, name, category, price FROM menu_items ORDER BY name ASC`);
  const ingredients = await getIngredients();
  const [outletRows] = await run(`SELECT DISTINCT outlet, branch FROM ingredients ORDER BY outlet ASC, branch ASC`);
  return { menuItems, ingredients, outlets: outletRows };
};

module.exports = {
  ensureSchema,
  getBootstrapData,
  upsertIngredient,
  getIngredients,
  createOrUpdateRecipe,
  getRecipeByItem,
  createSaleWithConsumption,
  reverseSaleConsumption,
  getConsumptionReport,
  getIngredientConsumptionSummary,
  getStockImpactView,
  getDashboardSummary,
  reconcileStock,
};
