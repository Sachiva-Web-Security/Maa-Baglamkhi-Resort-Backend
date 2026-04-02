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
);

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
);
