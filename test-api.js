#!/usr/bin/env node
const http = require("http");
const BASE = "http://localhost:5002";

let authToken = null;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  const tests = [
    // PUBLIC ENDPOINTS
    { name: "GET /api/health", method: "GET", path: "/api/health" },

    // RESTAURANT
    { name: "GET /api/restaurant/tables", method: "GET", path: "/api/restaurant/tables" },
    { name: "GET /api/restaurant/menu", method: "GET", path: "/api/restaurant/menu" },
    { name: "GET /api/restaurant/order", method: "GET", path: "/api/restaurant/order" },
    { name: "GET /api/restaurant/bills", method: "GET", path: "/api/restaurant/bills" },
    { name: "GET /api/restaurant/item-action-requests", method: "GET", path: "/api/restaurant/item-action-requests" },
    { name: "GET /api/restaurant/waiter-performance", method: "GET", path: "/api/restaurant/waiter-performance" },

    // KITCHEN
    { name: "GET /api/kitchen/orders", method: "GET", path: "/api/kitchen/orders" },

    // WAITER
    { name: "GET /api/waiter/orders/ready", method: "GET", path: "/api/waiter/orders/ready" },
    { name: "GET /api/waiter/live-board", method: "GET", path: "/api/waiter/live-board" },

    // REPORTS
    { name: "GET /api/reports/summary", method: "GET", path: "/api/reports/summary" },
    { name: "GET /api/report/daywise", method: "GET", path: "/api/report/daywise?start=2026-01-01&end=2026-12-31" },
    { name: "GET /api/report/items", method: "GET", path: "/api/report/items" },

    // FOLIO
    { name: "GET /api/hotel/folio/1", method: "GET", path: "/api/hotel/folio/1" },

    // DASHBOARD
    { name: "GET /api/dashboard/metrics", method: "GET", path: "/api/dashboard/metrics" },
    { name: "GET /api/dashboard/charts", method: "GET", path: "/api/dashboard/charts" },

    // AUTH
    { name: "POST /api/auth/register", method: "POST", path: "/api/auth/register", body: { name: "api test user", email: "apitest-" + Date.now() + "@test.com", password: "Test@123", role_id: 3 } },

    // USERS
    { name: "GET /api/users/me", method: "GET", path: "/api/users/me" },
    { name: "GET /api/users", method: "GET", path: "/api/users" },
    { name: "GET /api/users/1", method: "GET", path: "/api/users/1" },

    // SETTINGS
    { name: "GET /api/settings", method: "GET", path: "/api/settings" },

    // NOTIFICATIONS
    { name: "GET /api/notifications", method: "GET", path: "/api/notifications" },

    // ATTENDANCE
    { name: "GET /api/attendance", method: "GET", path: "/api/attendance" },

    // BANQUET
    { name: "GET /api/banquet/", method: "GET", path: "/api/banquet/" },
    { name: "GET /api/banquet/config", method: "GET", path: "/api/banquet/config" },

    // HOUSEKEEPING
    { name: "GET /api/housekeeping", method: "GET", path: "/api/housekeeping" },
    { name: "GET /api/housekeeping/logs", method: "GET", path: "/api/housekeeping/logs" },
    { name: "GET /api/housekeeping/notifications", method: "GET", path: "/api/housekeeping/notifications" },
    { name: "GET /api/housekeeping/amenities", method: "GET", path: "/api/housekeeping/amenities" },
    { name: "GET /api/housekeeping/inspections", method: "GET", path: "/api/housekeeping/inspections" },
    { name: "GET /api/housekeeping/lost-found", method: "GET", path: "/api/housekeeping/lost-found" },
    { name: "GET /api/housekeeping/roster", method: "GET", path: "/api/housekeeping/roster" },
    { name: "GET /api/housekeeping/costing", method: "GET", path: "/api/housekeeping/costing" },
    { name: "GET /api/housekeeping/checkout-report", method: "GET", path: "/api/housekeeping/checkout-report" },
    { name: "GET /api/housekeeping/completed-cleaning", method: "GET", path: "/api/housekeeping/completed-cleaning" },
    { name: "GET /api/housekeeping/parameters", method: "GET", path: "/api/housekeeping/parameters" },

    // INVENTORY
    { name: "GET /api/inventory", method: "GET", path: "/api/inventory" },
    { name: "GET /api/inventory/alerts/low-stock", method: "GET", path: "/api/inventory/alerts/low-stock" },
    { name: "GET /api/inventory/alerts/expiring", method: "GET", path: "/api/inventory/alerts/expiring" },
    { name: "GET /api/inventory/waste", method: "GET", path: "/api/inventory/waste" },
    { name: "GET /api/inventory/purchase-orders", method: "GET", path: "/api/inventory/purchase-orders" },
    { name: "GET /api/inventory/vendor-inwards", method: "GET", path: "/api/inventory/vendor-inwards" },
    { name: "GET /api/inventory/vendor-payments", method: "GET", path: "/api/inventory/vendor-payments" },
    { name: "GET /api/inventory/stock-ledger", method: "GET", path: "/api/inventory/stock-ledger" },
    { name: "GET /api/inventory/reports/stock-flow", method: "GET", path: "/api/inventory/reports/stock-flow" },
    { name: "GET /api/inventory/vendor-insights", method: "GET", path: "/api/inventory/vendor-insights" },
    { name: "GET /api/inventory/audit/report", method: "GET", path: "/api/inventory/audit/report" },
    { name: "GET /api/inventory/transfers", method: "GET", path: "/api/inventory/transfers" },
    { name: "GET /api/inventory/chef-issues", method: "GET", path: "/api/inventory/chef-issues" },

    // INVENTORY MASTERS
    { name: "GET /api/inventory-masters/sections", method: "GET", path: "/api/inventory-masters/sections" },

    // TOKEN
    { name: "GET /api/token", method: "GET", path: "/api/token/table/1" },

    // PAYMENT
    { name: "GET /api/payment", method: "GET", path: "/api/payment" },

    // ACCOUNTS
    { name: "GET /api/accounts/transactions", method: "GET", path: "/api/accounts/transactions" },
    { name: "GET /api/accounts/summary", method: "GET", path: "/api/accounts/summary" },
    { name: "GET /api/accounts/department-summary", method: "GET", path: "/api/accounts/department-summary" },
    { name: "GET /api/accounts/hotel-billing", method: "GET", path: "/api/accounts/hotel-billing" },
    { name: "GET /api/accounts/restaurant-billing", method: "GET", path: "/api/accounts/restaurant-billing" },
    { name: "GET /api/accounts/extended-summary", method: "GET", path: "/api/accounts/extended-summary" },
    { name: "GET /api/accounts/reconciliation/summary", method: "GET", path: "/api/accounts/reconciliation/summary" },
    { name: "GET /api/accounts/reconciliation/items", method: "GET", path: "/api/accounts/reconciliation/items" },
    { name: "GET /api/accounts/bank-ledger", method: "GET", path: "/api/accounts/bank-ledger" },
    { name: "GET /api/accounts/petty-cash", method: "GET", path: "/api/accounts/petty-cash" },
    { name: "GET /api/accounts/gst-returns", method: "GET", path: "/api/accounts/gst-returns" },
    { name: "GET /api/accounts/vendor-payments", method: "GET", path: "/api/accounts/vendor-payments" },
    { name: "GET /api/accounts/purchase-orders", method: "GET", path: "/api/accounts/purchase-orders" },
    { name: "GET /api/accounts/payroll", method: "GET", path: "/api/accounts/payroll" },
    { name: "GET /api/accounts/profit-centers", method: "GET", path: "/api/accounts/profit-centers" },
    { name: "GET /api/accounts/payment-settings", method: "GET", path: "/api/accounts/payment-settings" },
    { name: "GET /api/accounts/payment-history", method: "GET", path: "/api/accounts/payment-history" },

    // PRINT
    { name: "GET /api/print/history", method: "GET", path: "/api/print/history" },
    { name: "GET /api/print/status", method: "GET", path: "/api/print/status" },
    { name: "GET /api/print/queue", method: "GET", path: "/api/print/queue" },
    { name: "GET /api/print/types", method: "GET", path: "/api/print/types" },

    // CHEF
    { name: "GET /api/chef/orders", method: "GET", path: "/api/chef/orders" },
    { name: "GET /api/chef/notifications", method: "GET", path: "/api/chef/notifications" },

    // ASSIGNMENTS
    { name: "GET /api/assignments", method: "GET", path: "/api/assignments" },
    { name: "GET /api/assignments/stats", method: "GET", path: "/api/assignments/stats" },

    // AUDIT
    { name: "GET /api/audit-logs", method: "GET", path: "/api/audit-logs" },

    // SALARY
    { name: "GET /api/salary/", method: "GET", path: "/api/salary/" },
  ];

  console.log(`\n🧪 Running ${tests.length} API tests...\n`);

  const timeoutMs = 10000;

  for (const test of tests) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { status, body } = await request(test.method, test.path, test.body, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (test.path === "/api/auth/login" && status === 200 && body.token) {
        authToken = body.token;
        console.log(`🔑 Got auth token`);
      }

      if (status === 200 || status === 201 || status === 204) {
        passed++;
        console.log(`✅ ${test.name}`);
      } else if (status === 401) {
        passed++;
        console.log(`✅ ${test.name} (401 - auth required, endpoint exists)`);
      } else if (status === 404) {
        failed++;
        failures.push({ name: test.name, status, error: typeof body === "string" ? body.slice(0, 100) : JSON.stringify(body).slice(0, 100) });
        console.log(`❌ ${test.name} (404 - route not found)`);
      } else {
        failed++;
        failures.push({ name: test.name, status, error: typeof body === "string" ? body.slice(0, 100) : JSON.stringify(body).slice(0, 100) });
        console.log(`❌ ${test.name} (${status}): ${typeof body === "string" ? body.slice(0, 80) : JSON.stringify(body).slice(0, 80)}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      failed++;
      const errorMsg = err.message || "Unknown error";
      failures.push({ name: test.name, error: errorMsg });
      console.log(`❌ ${test.name} (${errorMsg})`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 Test Results: ${passed}/${tests.length} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}`);

  if (failures.length > 0) {
    console.log("\n❌ Failed Tests:");
    failures.forEach((f) => {
      console.log(`  - ${f.name}: ${f.error || f.status}`);
    });
  }

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log("\n✅ All tests passed!");
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
