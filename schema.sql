-- =========================================
-- Baglamukhi Resort Restaurant System
-- =========================================

-- ===============================
-- 1. Tables (Restaurant Tables)
-- ===============================

CREATE TABLE IF NOT EXISTS tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    number VARCHAR(50) NOT NULL UNIQUE
);

-- ===============================
-- 2. Menu Items
-- ===============================

CREATE TABLE IF NOT EXISTS menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100) DEFAULT 'Others',
    table_number VARCHAR(50) NULL
);

-- ===============================
-- 3. Orders
-- ===============================

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tableNumber VARCHAR(50) NOT NULL,
    status ENUM('pending','paid') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- 4. Order Items
-- ===============================

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INT DEFAULT 1,

    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE
);

-- ===============================
-- 5. Bills
-- ===============================

CREATE TABLE IF NOT EXISTS bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tableNumber VARCHAR(50) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    gst DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    paymentMethod VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- 6. Tokens
-- ===============================

CREATE TABLE IF NOT EXISTS tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tableNumber VARCHAR(50) NOT NULL,
    waiter VARCHAR(100),
    status ENUM('active','closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- 7. Token Items
-- ===============================

CREATE TABLE IF NOT EXISTS token_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    qty INT DEFAULT 1,
    rate DECIMAL(10,2) NOT NULL,

    FOREIGN KEY (token_id)
    REFERENCES tokens(id)
    ON DELETE CASCADE
);

-- ===============================
-- 8. Payments
-- ===============================

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tableNumber VARCHAR(50) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    paymentMethod VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- 9. Table Menu Mapping
-- (optional table specific menu)
-- ===============================

CREATE TABLE IF NOT EXISTS table_menu_map (
    menu_item_id INT NOT NULL,
    table_number VARCHAR(50) NOT NULL,

    PRIMARY KEY(menu_item_id, table_number)
);
