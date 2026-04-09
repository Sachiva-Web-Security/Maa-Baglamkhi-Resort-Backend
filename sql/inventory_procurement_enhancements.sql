CREATE TABLE IF NOT EXISTS inventory_vendor_inwards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NULL,
  po_number VARCHAR(120) NULL,
  vendor_name VARCHAR(255) NOT NULL,
  item_id INT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity_received DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(60) NULL,
  rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  invoice_no VARCHAR(120) NULL,
  batch_no VARCHAR(120) NULL,
  expiry_date DATE NULL,
  received_date DATE NOT NULL,
  store VARCHAR(120) NULL,
  remarks TEXT NULL,
  stock_updated TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE inventory_vendor_inwards
  ADD COLUMN IF NOT EXISTS batch_no VARCHAR(120) NULL AFTER invoice_no,
  ADD COLUMN IF NOT EXISTS expiry_date DATE NULL AFTER batch_no;

CREATE TABLE IF NOT EXISTS vendor_payment_records (
  id INT NOT NULL AUTO_INCREMENT,
  vendor_name VARCHAR(255) NOT NULL,
  invoice_ref VARCHAR(120) DEFAULT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_mode VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
  status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
  notes TEXT NULL,
  source_module VARCHAR(80) NULL,
  source_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_vendor_payment_date (payment_date),
  INDEX idx_vendor_payment_vendor (vendor_name),
  INDEX idx_vendor_payment_source (source_module, source_id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT NOT NULL AUTO_INCREMENT,
  po_number VARCHAR(100) NOT NULL,
  vendor_name VARCHAR(255) NOT NULL,
  order_date DATE NOT NULL,
  expected_date DATE DEFAULT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Draft',
  notes TEXT NULL,
  source_module VARCHAR(80) NULL,
  source_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_order_number (po_number),
  INDEX idx_purchase_order_date (order_date),
  INDEX idx_purchase_order_source (source_module, source_id)
);

ALTER TABLE vendor_payment_records
  ADD COLUMN IF NOT EXISTS source_module VARCHAR(80) NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS source_id INT NULL AFTER source_module;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS source_module VARCHAR(80) NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS source_id INT NULL AFTER source_module;

CREATE TABLE IF NOT EXISTS inventory_vendor_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name VARCHAR(255) NOT NULL,
  invoice_ref VARCHAR(120) NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_mode VARCHAR(80) NOT NULL DEFAULT 'Bank Transfer',
  status VARCHAR(60) NOT NULL DEFAULT 'Scheduled',
  notes TEXT NULL,
  created_by VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_stock_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NULL,
  item_name VARCHAR(255) NULL,
  reference_type VARCHAR(80) NOT NULL,
  reference_id INT NULL,
  direction VARCHAR(10) NOT NULL DEFAULT 'IN',
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(60) NULL,
  vendor_name VARCHAR(255) NULL,
  location_name VARCHAR(120) NULL,
  rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_after DECIMAL(10,2) NULL,
  remarks TEXT NULL,
  entry_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
