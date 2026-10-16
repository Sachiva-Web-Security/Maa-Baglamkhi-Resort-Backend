import { chromium } from "playwright";

const BASE = "http://localhost:5173";

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    "/Users/apple/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell",
});
const page = await browser.newPage();

const events = [];
page.on("response", (r) => {
  if (r.url().includes("profit") || r.status() >= 400) {
    events.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().split("localhost")[1]}`);
  }
});
page.on("request", (r) => {
  if (r.url().includes("profit") && r.method() === "POST") {
    events.push(`REQ: ${r.postData()}`);
  }
});

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("accounts@resort.com");
await page.locator('input[type="password"]').fill("password");
await page.getByRole("button", { name: "Sign In" }).click();
await page.waitForTimeout(3000);

await page.goto(`${BASE}/accounts`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

await page.getByRole("button", { name: "Accounts Tab" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Add Profit Entry" }).click();
await page.waitForTimeout(1000);

await page.locator('select[name="centerName"]').selectOption("Banquet");
await page.locator('input[name="entryDate"]').fill("2026-03-31");
await page.locator('input[name="incomeAmount"]').fill("3210");
await page.locator('input[name="expenseAmount"]').fill("210");
await page.locator('textarea[name="notes"]').fill("debug profit entry");
await page.locator('form button[type="submit"]').click();
await page.waitForTimeout(6000);

const cells = await page.getByRole("cell").allTextContents();
console.log("All cells:", cells.slice(0, 30));

console.log("\n=== EVENTS ===");
events.forEach((e) => console.log("  " + e));

await browser.close();
