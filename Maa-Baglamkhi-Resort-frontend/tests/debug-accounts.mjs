import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const API = "http://localhost:5002/api";

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    "/Users/apple/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell",
});
const page = await browser.newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`CONSOLE: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on("requestfailed", (r) => errors.push(`REQFAIL: ${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
});

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("accounts@resort.com");
await page.locator('input[type="password"]').fill("password");
await page.getByRole("button", { name: "Sign In" }).click();

// Wait for navigation to settle
await page.waitForTimeout(6000);
console.log("URL after login:", page.url());

await page.goto(`${BASE}/accounts`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
console.log("URL at /accounts:", page.url());

const heading = await page.getByRole("heading").first().textContent().catch(() => null);
console.log("First heading:", JSON.stringify(heading));

const bodyText = (await page.locator("body").textContent().catch(() => "")) || "";
console.log("Body text (first 600):", bodyText.slice(0, 600));

// Is the expected text anywhere?
console.log(
  "has 'Accounts workspace in dashboard style':",
  bodyText.includes("Accounts workspace in dashboard style")
);
console.log("has 'Total Income':", bodyText.includes("Total Income"));

if (errors.length) {
  console.log("\n=== ERRORS (" + errors.length + ") ===");
  errors.slice(0, 25).forEach((e) => console.log("  " + e.slice(0, 250)));
}

await browser.close();
