const db = require("../config/db");

const ensureSalaryPaymentsSchema = async () => {
  try {
    await db.promise().query(
      `CREATE TABLE IF NOT EXISTS salary_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        status ENUM('Pending','Paid','Partial','On Hold') DEFAULT 'Pending',
        amount_paid DECIMAL(10,2) DEFAULT 0.00,
        payment_mode VARCHAR(50) DEFAULT NULL,
        paid_on DATE DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_month (user_id, year, month),
        FOREIGN KEY (user_id) REFERENCES register(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
  } catch (err) {
    console.error("Salary payments schema init failed:", err.message);
  }
};

module.exports = { ensureSalaryPaymentsSchema };
