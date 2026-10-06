#!/usr/bin/env node
// Seed database directly using app's DB pool
require("dotenv").config();
const db = require("./src/config/db");

async function main() {
  console.log("Seeding test data...");

  await db.query(`INSERT IGNORE INTO users (id, name, email, password_hash, role_id, status)
    VALUES (1, 'Test Admin', 'admin@resort.com', 'admin123', 1, 'active')`);

  await db.query(`INSERT IGNORE INTO bookings (id, booking_code, status, check_in, check_out, adults, children, total_rooms, total_guests, created_by)
    VALUES (1, 'BK-TEST-001', 'confirmed', '2026-01-01', '2026-01-03', 2, 0, 1, 2, 1)`);

  await db.query(`INSERT IGNORE INTO restaurant_tables (id, number, seat_count, status)
    VALUES (1, 'T1', 4, 'available')`);

  await db.query(`INSERT IGNORE INTO tokens (id, token_code, table_id, table_number, waiter_id, waiter_name, status)
    VALUES (1, 'TK001', 1, 'T1', 1, 'Test Waiter', 'active')`);

  await db.query(`INSERT IGNORE INTO kitchen_orders (id, table_number, waiter_name, items, status, token_status)
    VALUES (1, 'T1', 'Test Waiter', '[{"item":"Test","qty":1}]', 'pending', 'Active')`);

  await db.query(`INSERT IGNORE INTO kot_orders (id, order_id, table_number, waiter_name, items, status)
    VALUES (1, 1, 'T1', 'Test Waiter', '[{"item":"Test"}]', 'pending')`);

  await db.query(`INSERT IGNORE INTO orders (id, table_id, table_number, token_id, waiter_id, waiter_name, status, subtotal, tax_amount, total_amount)
    VALUES (1, 1, 'T1', 1, 1, 'Test Waiter', 'pending', 100, 0, 100)`);

  await db.query(`INSERT IGNORE INTO inventory_items (id, name, category_id, unit_id, unit_cost, selling_price)
    VALUES (1, 'Test Item', 1, 1, 10, 15)`);

  await db.query(`INSERT IGNORE INTO inventory_waste_log (id, item_id, item_name, quantity, unit, reason, created_by)
    VALUES (1, 1, 'Test Item', 1, 'pcs', 'test', 'admin')`);

  await db.query(`INSERT IGNORE INTO inventory_chef_issues (id, item_id, item_name, quantity_issued, unit, status, issued_at)
    VALUES (1, 1, 'Test Item', 1, 'pcs', 'issued', NOW())`);

  await db.query(`INSERT IGNORE INTO accounts_transactions (id, date, type, department, description, amount, payment_mode, source_module, created_by)
    VALUES (1, CURDATE(), 'Income', 'Other', 'Test', 100, 'cash', 'test', 1)`);

  await db.query(`INSERT IGNORE INTO housekeeping (id, type, roomNo, status, assignee)
    VALUES (1, 'Accommodation', '101', 'Vacant Dirty', 'No Housekeeper')`);

  await db.query(`INSERT IGNORE INTO hk_inspections (id, room_no, inspector_name, priority, score, notes)
    VALUES (1, '101', 'Test Inspector', 'Normal', 0, 'test')`);

  await db.query(`INSERT IGNORE INTO menu_items (id, category_id, name, description, price, tax_percent, food_type, availability_status, status)
    VALUES (1, 1, 'Test Menu', 'Test', 50, 5, 'Veg', 'Available', 'available')`);

  await db.query(`INSERT IGNORE INTO token_items (id, token_id, item_name, qty, rate)
    VALUES (1, 1, 'Test Item', 1, 50)`);

  await db.query(`INSERT IGNORE INTO invoices (id, booking_id, invoice_no, customer_name, date, total, payment_status, created_by)
    VALUES (1, 1, 'INV-TEST-001', 'Test Guest', CURDATE(), 100, 'unpaid', 1)`);

  await db.query(`INSERT IGNORE INTO bills (id, order_id, table_number, token_id, entity_type, waiter_name, customer_name, phone, subtotal, service_charge, tax_amount, total, payment_method, payment_status, split_no, split_count)
    VALUES (1, 1, 'T1', 1, 'Table', 'Test Waiter', 'Test Guest', '9999999999', 100, 0, 0, 100, 'cash', 'unpaid', 0, 0)`);

  await db.query(`INSERT IGNORE INTO banquet_bookings (id, hall_id, customer_name, event_title, event_date, start_time, end_time, status, created_by)
    VALUES (1, 1, 'Test Customer', 'Test Event', '2026-02-01', '10:00:00', '18:00:00', 'confirmed', 1)`);

  await db.query(`INSERT IGNORE INTO vendor_payment_records (id, vendor_name, payment_date, amount, payment_mode, status)
    VALUES (1, 'Test Vendor', CURDATE(), 100, 'cash', 'Scheduled')`);

  await db.query(`INSERT IGNORE INTO purchase_orders (id, po_number, vendor_name, order_date, total_amount, status)
    VALUES (1, 'PO-TEST-001', 'Test Vendor', CURDATE(), 500, 'Draft')`);

  await db.query(`INSERT IGNORE INTO salary_payments (id, employee_id, month, basic_salary, allowances, deductions, net_salary, status)
    VALUES (1, 1, '2026-01-01', 5000, 500, 200, 5300, 'draft')`);

  console.log("Data seeded successfully!");
  await db.end();
}

main().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
