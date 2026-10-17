import { expect, test } from "playwright/test";

const ADMIN = "admin@resort.com";
const KITCHEN = "kitchen@resort.com";
const PW = "password";

async function login(page, email) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(dashboard|kitchen-dashboard)/, { timeout: 30_000 });
}

test.describe("Staff slice smoke: attendance and payroll", () => {
  test("admin sees the attendance roster with status counts", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/attendance");
    await page.waitForURL(/\/attendance$/, { timeout: 30_000 });

    await expect(page.getByText("Present").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Absent").first()).toBeVisible();

    // The roster merge means rows exist even when nobody is marked for the date.
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes("--") || /present|absent|late|leave|holiday/i.test(text);
    }, { timeout: 15_000 });
  });

  test("admin payroll page lists payments and roles tabs", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/payroll");
    await page.waitForURL(/\/payroll$/, { timeout: 30_000 });

    await expect(page.getByRole("button", { name: "Salary Payments" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Roles & Permissions" })).toBeVisible();
    await expect(page.getByText("Total Records")).toBeVisible();
    await expect(page.getByText("Gross Pay")).toBeVisible();
    await expect(page.getByText("Paid Out")).toBeVisible();
    await expect(page.getByText("New Salary Payment")).toBeVisible();

    await page.getByRole("button", { name: "Roles & Permissions" }).click();
    await expect(page.getByText("Administrator").first()).toBeVisible({ timeout: 10_000 });
  });

  test("kitchen role is locked out of the payroll page", async ({ page }) => {
    await login(page, KITCHEN);
    await page.goto("/payroll");
    await page.waitForTimeout(4000);

    // ProtectedRoute must not render the payroll content to a non-admin.
    await expect(page.getByText("Total Records")).toHaveCount(0);
    await expect(page.getByText("New Salary Payment")).toHaveCount(0);
  });

  test("non-admin sees their own attendance page", async ({ page }) => {
    await login(page, KITCHEN);
    await page.goto("/my-attendance");
    await page.waitForURL(/\/my-attendance$/, { timeout: 30_000 });

    await expect(page.getByText("Present").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Monthly Pay").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Present" })).toBeVisible();
  });
});
