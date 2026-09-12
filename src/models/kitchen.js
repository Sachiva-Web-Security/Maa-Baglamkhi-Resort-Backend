const db = require("../config/db");

const ensureColumn = async (tableName, columnName, definition) => {
  const [rows] = await db
    .promise()
    .query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);

  if (!rows.length) {
    await db.promise().query(
      `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`
    );
  }
};

const ensureSchema = async () => {
  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS kitchen_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_number VARCHAR(50) NOT NULL,
      waiter_name VARCHAR(100) NULL,
      entity_type VARCHAR(30) DEFAULT 'Table',
      items LONGTEXT NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      token_status VARCHAR(50) DEFAULT 'Active',
      kot_no VARCHAR(100) DEFAULT NULL,
      prep_time_minutes INT DEFAULT 20,
      expected_ready_at DATETIME NULL,
      ready_at DATETIME NULL,
      ready_message VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("kitchen_orders", "entity_type", "VARCHAR(30) DEFAULT 'Table'");
  await ensureColumn("kitchen_orders", "prep_time_minutes", "INT DEFAULT 20");
  await ensureColumn("kitchen_orders", "token_status", "VARCHAR(50) DEFAULT 'Active'");
  await ensureColumn("kitchen_orders", "kot_no", "VARCHAR(100) DEFAULT NULL");
  await ensureColumn("kitchen_orders", "expected_ready_at", "DATETIME NULL");
  await ensureColumn("kitchen_orders", "ready_at", "DATETIME NULL");
  await ensureColumn("kitchen_orders", "ready_message", "VARCHAR(255) NULL");
};

const createOrder = (data, callback) => {
  const sql = "INSERT INTO kitchen_orders SET ?";
  db.query(sql, data, callback);
};

const getOrders = (callback) => {
  const sql = "SELECT * FROM kitchen_orders ORDER BY id DESC";
  db.query(sql, callback);
};

const getOrderById = (id, callback) => {
  const sql = "SELECT * FROM kitchen_orders WHERE id=? LIMIT 1";
  db.query(sql, [id], callback);
};

const updateOrder = (id, data, callback) => {
  const sql = "UPDATE kitchen_orders SET ? WHERE id=?";
  db.query(sql, [data, id], callback);
};

const cancelOrder = (id, callback) => {
  const sql = "DELETE FROM kitchen_orders WHERE id=?";
  db.query(sql, [id], callback);
};

module.exports = {
  ensureSchema,
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
};
