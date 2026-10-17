import { test } from "playwright/test";

const BASE = "http://127.0.0.1:5173";
// Match only sentences that announce an empty state, never header words like
// the column label "Actions" or "Total Rooms".
const EMPTY_RE =
  /\bno (?:records?|results?|data|items?|users?|entries?|messages?|documents?|activity|bookings?|deliveries?|categories|units|vendors|logs)\b(?=[\s\S]{0,40}\b(?:found|pending|to show|available|yet|here|loaded))|\bnothing to show\b/i;
const SPINNER_RE = /loading\.\.\.|please wait|fetching/i;

const PAGES = [
  "/dashboard", "/manager-dashboard", "/reception-dashboard", "/housekeeping-dashboard",
  "/accounts-dashboard", "/kitchen-dashboard", "/chef-dashboard", "/restaurant-dashboard",
  "/staff-dashboard", "/profile", "/attendance", "/my-attendance", "/salary", "/payroll",
  "/hotel", "/accounts", "/accounts/bank-reconciliation", "/accounts/reconciliation-data",
  "/accounts/customer-invoices", "/audit-logs", "/inventory", "/inventory/items",
  "/inventory/categories", "/inventory/stock-categories", "/inventory/units",
  "/inventory/vendors", "/inventory/menu-items", "/inventory/menu-list",
  "/inventory/purchases", "/inventory/reports", "/inventory/masters", "/inventory/recipes",
  "/inventory/chef-issues", "/chef/inventory", "/housekeeping", "/housekeeping/notifications",
  "/banquet", "/reports", "/assignments", "/assignment-notification", "/kitchen",
  "/waiter-delivery", "/user", "/print", "/reports/sales", "/reports/income-exp",
  "/reports/daywise", "/reports/collection", "/reports/audit", "/restaurant",
];

test.describe.configure({ timeout: 600000 });

test("audit every page for silent failures", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const httpFail = [];
  const consoleErr = [];
  const pageErr = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErr.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => pageErr.push(String(e.message).slice(0, 200)));
  page.on("response", (r) => {
    if (r.status() >= 400) httpFail.push(`${r.status()} ${r.url().replace(BASE + "/api", "").split("?")[0]}`);
  });

  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[placeholder="email@resort.com"]').fill("admin@resort.com");
  await page.locator('input[placeholder="••••••••"]').fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => ({ path: location.pathname, stored: JSON.parse(JSON.stringify(localStorage)) }));
  console.log("LOGIN landed at", after.path, "keys", Object.keys(after.stored));

  const flagged = [];
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2500);
    const s = await page.evaluate(() => {
      const t = document.body.innerText || "";
      const lines = t.split("\n").map((l) => l.trim()).filter((l) => l.length > 1);
      return { len: t.length, lines: lines.length, txt: t.slice(0, 1200), url: location.pathname };
    });
    const empty = EMPTY_RE.test(s.txt);
    const spin = SPINNER_RE.test(s.txt);
    const noShell = s.txt.replace(/\n/g, "").length < 120;
    if (noShell || spin) flagged.push(`${p} (landed ${s.url}) len=${s.len} lines=${s.lines} noShell=${noShell} spin=${spin}`);
  }

  console.log(`\n==== AUDIT: ${PAGES.length} pages ====`);
  console.log(`HTTP >=400: ${httpFail.length}`);
  for (const h of [...new Set(httpFail)]) console.log("  HTTP " + h);
  console.log(`pageerror: ${pageErr.length}`);
  for (const e of [...new Set(pageErr)]) console.log("  PAGEERR " + e);
  console.log(`console.error: ${consoleErr.length}`);
  for (const e of [...new Set(consoleErr)].slice(0, 40)) console.log("  CONERR " + e);
  console.log(`FLAGGED pages: ${flagged.length}`);
  for (const f of flagged) console.log("  FLAG " + f);
  await ctx.close();
  test.pass(flagged.length === 0, "no blank or spinner-locked pages");
});
