import { chromium } from "playwright";

const BASE = "http://localhost:5173";

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    "/Users/apple/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell",
});
const page = await browser.newPage();

const events = [];
page.on("console", (m) => events.push(`[${m.type()}] ${m.text()}`.slice(0, 220)));
page.on("response", (r) => {
  if (r.url().includes("bank-ledger") || r.status() >= 400) {
    events.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().split("localhost")[1]}`);
  }
});
page.on("request", (r) => {
  if (r.url().includes("bank-ledger") && r.method() === "POST") {
    events.push(`REQ BODY: ${r.postData()}`);
  }
});

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("accounts@resort.com");
await page.locator('input[type="password"]').fill("password");
await page.getByRole("button", { name: "Sign In" }).click();
await page.waitForTimeout(3000);
console.log("After login:", page.url());

await page.goto(`${BASE}/accounts/reconciliation-data`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
console.log("URL:", page.url());

const formBtn = page.getByRole("button", { name: "Form Filling" });
if (await formBtn.count()) {
  await formBtn.click();
  await page.waitForTimeout(1000);
  console.log("Clicked Form Filling");
}

// Fill the form like the test does
const suffix = Date.now();
await page.locator('input[name="entryDate"]').fill("2026-03-31");
await page.locator('input[name="bankName"]').fill(`PW Bank ${suffix}`);
await page.locator('input[name="referenceNo"]').fill(`PW-BNK-${suffix}`);
await page.locator('input[name="description"]').fill("Accounts smoke bank entry");
await page.locator('input[name="debit"]').fill("0");
await page.locator('input[name="credit"]').fill("4321");

const statSel = page.locator('select[name="reconciliationStatus"]');
if (await statSel.count()) {
  await statSel.selectOption("Paid");
  console.log("Set reconciliationStatus=Paid");
} else {
  console.log("!! select[name=reconciliationStatus] NOT FOUND");
}

const submit = page.locator('form button[type="submit"]');
console.log("Submit buttons found:", await submit.count());
if (await submit.count()) {
  await submit.click();
  console.log("Clicked submit");
  await page.waitForTimeout(5000);
}

// What does the table show now?
const cells = await page.getByRole("cell").allTextContents();
console.log("Cells containing 'PW Bank':", cells.filter((c) => c.includes("PW Bank")));
console.log("Cells containing 'Paid':", cells.filter((c) => c === "Paid"));

console.log("\n=== EVENTS ===");
events.forEach((e) => console.log("  " + e));

await browser.close();
