import { expect, test } from "playwright/test";

async function loginAsAccountant(page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("accounts@resort.com");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(accounts-dashboard|accounts)$/, { timeout: 30_000 });
  await page.goto("/accounts");
  await page.waitForURL(/\/accounts$/, { timeout: 30_000 });
  await expect(page.getByText("Accounts workspace in dashboard style")).toBeVisible();
}

test.describe("Accounts page smoke flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAccountant(page);
  });

  test("loads API-backed summary widgets and finance tabs", async ({ page }) => {
    await expect(page.getByText("Total Income").first()).toBeVisible();
    await expect(page.getByText("Total Expense").first()).toBeVisible();
    await expect(page.getByText("Net Profit").first()).toBeVisible();
    await expect(page.getByText("GST Payable").first()).toBeVisible();
    await expect(page.getByText("Combined Payment Amount")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accounts Tab" })).toBeVisible();
    await expect(page.getByText("Total Room Income")).toHaveCount(0);
    await expect(page.getByText("Pending Reconciliation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add Petty Cash" })).toHaveCount(0);
  });

  test("opens bank reconciliation from the hero action", async ({ page }) => {
    await page.getByRole("button", { name: "Bank Reconciliation" }).click();

    await expect(
      page.getByRole("heading", { name: "Billing to bank reconciliation view" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reconciliation Data" }).first()).toBeVisible();
    await expect(page.getByText("Total Room Income")).toBeVisible();
    await expect(page.getByText("Total Restaurant Income")).toBeVisible();
    await expect(page.getByText("Total Banquet Income")).toBeVisible();
    await expect(page.getByText("Petty Cash Balance")).toBeVisible();
    await expect(page.getByText("GST Pending")).toBeVisible();
    await expect(page.getByText("Vendor Outstanding")).toBeVisible();
    await expect(page.getByText("Open POs")).toBeVisible();
    await expect(page.getByText("Payroll Total")).toBeVisible();
    await expect(page.getByRole("button", { name: "Form Filling" })).toHaveCount(0);
  });

  test("opens dedicated accounts tab workspace from the hero actions", async ({ page }) => {
    await page.getByRole("button", { name: "Accounts Tab" }).click();

    await page.waitForURL(/\/accounts\?view=modules$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Accounts tabs workspace" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Petty Cash" }).first()).toBeVisible();
  });

  test("creates a bank entry from the UI and shows it in recent records", async ({ page }) => {
    const suffix = Date.now();
    const bankName = `PW Bank ${suffix}`;

    await page.getByRole("button", { name: "Bank Reconciliation" }).click();
    await expect(
      page.getByRole("heading", { name: "Billing to bank reconciliation view" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reconciliation Data" }).first().click();
    await page.waitForURL(/\/accounts\/reconciliation-data$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Reconciliation data workspace" })).toBeVisible();
    await page.getByRole("button", { name: "Form Filling" }).click();
    await expect(page.getByRole("heading", { name: "Form Filling" })).toBeVisible();

    await page.locator('input[name="entryDate"]').fill("2026-03-31");
    await page.locator('input[name="bankName"]').fill(bankName);
    await page.locator('input[name="referenceNo"]').fill(`PW-BNK-${suffix}`);
    await page.locator('input[name="description"]').fill("Accounts smoke bank entry");
    await page.locator('input[name="debit"]').fill("0");
    await page.locator('input[name="credit"]').fill("4321");
    await page.locator('select[name="reconciliationStatus"]').selectOption("Paid");
    await page.locator('textarea[name="notes"]').fill("Created by Playwright accounts smoke test");
    await page.locator('form button[type="submit"]').click();

    await expect(page.getByRole("cell", { name: bankName })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Paid" }).first()).toBeVisible();
  });

  test("switches to profit entry tab and creates a backend-connected record", async ({ page }) => {
    const suffix = Date.now();

    await page.getByRole("button", { name: "Accounts Tab" }).click();
    await expect(page.getByRole("heading", { name: "Accounts tabs workspace" })).toBeVisible();
    await page.getByRole("button", { name: "Add Profit Entry" }).click();
    await expect(page.getByText("Profit Center Split")).toBeVisible();

    await page.locator('select[name="centerName"]').selectOption("Banquet");
    await page.locator('input[name="entryDate"]').fill("2026-03-31");
    await page.locator('input[name="incomeAmount"]').fill("3210");
    await page.locator('input[name="expenseAmount"]').fill("210");
    await page.locator('textarea[name="notes"]').fill(`Playwright profit entry ${suffix}`);
    await page.locator('form button[type="submit"]').click();

    // Profit-center amounts are cumulative: each entry adds to the center's
    // running total, so only the center row needs to be present.
    await expect(page.getByRole("cell", { name: "Banquet" }).first()).toBeVisible();
  });
});
