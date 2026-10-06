#!/usr/bin/env node
// Seed test data via API so ID-based reads find records
const http = require("http");

const BASE = "http://localhost:5002";
const AUTH = { email: "admin@resort.com", password: "password" };

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname, method, headers, timeout: 10000 },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(d) });
          } catch {
            resolve({ status: res.statusCode, body: d });
          }
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log("Logging in...");
  const login = await request("POST", "/api/auth/login", AUTH);
  const token = login.body?.token;
  if (!token) {
    console.error("Login failed:", login.body);
    process.exit(1);
  }
  console.log("Got token");

  const created = {};

  // 1. Create booking
  console.log("Creating booking...");
  const booking = await request("POST", "/api/booking/guest", {
    guestName: "Test Guest",
    checkIn: "2026-01-01",
    checkOut: "2026-01-03",
    adults: 2,
    bookingStatus: "confirmed"
  }, token);
  console.log("Booking:", booking.status, JSON.stringify(booking.body).slice(0, 100));
  created.bookingId = booking.body?.id || booking.body?.bookingId || 1;

  // 2. Create restaurant table
  console.log("Creating table...");
  const table = await request("POST", "/api/restaurant/tables", {
    tableNumber: "T" + Date.now(),
    capacity: 4
  }, token);
  console.log("Table:", table.status, JSON.stringify(table.body).slice(0, 100));
  created.tableId = table.body?.id || 1;

  // 3. Create token
  console.log("Creating token...");
  const tokenResp = await request("POST", "/api/token/create", {
    tableNumber: "T" + Date.now(),
    waiterName: "Test Waiter"
  }, token);
  console.log("Token:", tokenResp.status, JSON.stringify(tokenResp.body).slice(0, 100));
  created.tokenId = tokenResp.body?.id || 1;

  // 4. Create kitchen order
  console.log("Creating kitchen order...");
  const ko = await request("POST", "/api/kitchen/order", {
    tableNumber: "T" + Date.now(),
    items: [{ name: "Test Item", qty: 1, price: 50 }]
  }, token);
  console.log("Kitchen order:", ko.status, JSON.stringify(ko.body).slice(0, 100));
  created.kitchenOrderId = ko.body?.id || 1;

  // 5. Create restaurant order
  console.log("Creating order...");
  const order = await request("POST", "/api/restaurant/order/add", {
    tableNumber: "T" + Date.now(),
    items: [{ name: "Test Item", qty: 1, price: 50 }]
  }, token);
  console.log("Order:", order.status, JSON.stringify(order.body).slice(0, 100));
  created.orderId = order.body?.id || 1;

  // 6. Create menu item
  console.log("Creating menu item...");
  const menu = await request("POST", "/api/restaurant/menu", {
    name: "Test Menu " + Date.now(),
    category: "test",
    price: 50
  }, token);
  console.log("Menu:", menu.status, JSON.stringify(menu.body).slice(0, 100));
  created.menuId = menu.body?.id || 1;

  // 7. Create token item
  console.log("Creating token item...");
  const ti = await request("POST", "/api/token/item", {
    tokenId: created.tokenId,
    itemName: "Test Item",
    qty: 1,
    price: 50
  }, token);
  console.log("Token item:", ti.status, ti.body?.id || "?");
  created.tokenItemId = ti.body?.id || 1;

  // 8. Create inventory item
  console.log("Creating inventory item...");
  const inv = await request("POST", "/api/inventory", {
    name: "Test Item " + Date.now(),
    category: "test",
    unit: "pcs",
    currentStock: 10,
    minStock: 5
  }, token);
  console.log("Inventory:", inv.status, JSON.stringify(inv.body).slice(0, 100));
  created.inventoryId = inv.body?.id || 1;

  // 9. Create waste log
  console.log("Creating waste log...");
  const waste = await request("POST", "/api/inventory/waste", {
    itemId: created.inventoryId,
    qty: 1,
    reason: "test"
  }, token);
  console.log("Waste:", waste.status, JSON.stringify(waste.body).slice(0, 100));
  created.wasteId = waste.body?.id || 1;

  // 10. Create chef issue
  console.log("Creating chef issue...");
  const ci = await request("POST", "/api/inventory/chef-issues", {
    itemId: created.inventoryId,
    qty: 1,
    issueType: "test"
  }, token);
  console.log("Chef issue:", ci.status, JSON.stringify(ci.body).slice(0, 100));
  created.chefIssueId = ci.body?.id || 1;

  // 11. Create transaction
  console.log("Creating transaction...");
  const tx = await request("POST", "/api/accounts/transactions", {
    type: "Income",
    department: "Test",
    description: "Test",
    amount: 100,
    paymentMode: "cash"
  }, token);
  console.log("Transaction:", tx.status, JSON.stringify(tx.body).slice(0, 100));
  created.transactionId = tx.body?.id || 1;

  // 12. Create housekeeping room
  console.log("Creating housekeeping room...");
  const hk = await request("POST", "/api/housekeeping/rooms", {
    roomNumber: "10" + Date.now() % 1000,
    status: "pending"
  }, token);
  console.log("Housekeeping:", hk.status, JSON.stringify(hk.body).slice(0, 100));
  created.hkId = hk.body?.id || 1;

  // 13. Create inspection
  console.log("Creating inspection...");
  const insp = await request("POST", "/api/housekeeping/inspections", {
    roomNumber: "101",
    status: "pending",
    score: 0,
    notes: "test"
  }, token);
  console.log("Inspection:", insp.status, JSON.stringify(insp.body).slice(0, 100));
  created.inspectionId = insp.body?.id || 1;

  // Save created IDs for test
  require("fs").writeFileSync("/tmp/seed-data.json", JSON.stringify(created, null, 2));
  console.log("\nCreated IDs saved to /tmp/seed-data.json");
  console.log("Seeding complete!");
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
