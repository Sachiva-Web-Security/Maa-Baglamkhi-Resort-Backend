import { expect, test } from "playwright/test";

async function loginAsManager(page) {
  await page.goto("/login");
  const emailField = page.locator('input[type="email"]');
  const passwordField = page.locator('input[type="password"]');
  const signInButton = page.getByRole("button", { name: "Sign In" });
  const networkErrorText = page.getByText(/Cannot reach server/i);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await emailField.fill("manager@resort.com");
    await passwordField.fill("password");
    await signInButton.click();

    try {
      await page.waitForURL(/\/manager-dashboard$/, { timeout: 15_000 });
      return;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }

      if (await networkErrorText.isVisible().catch(() => false)) {
        await page.waitForTimeout(2_000);
        continue;
      }

      throw error;
    }
  }
}

async function selectFirstNonEmptyOption(selectLocator) {
  const options = await selectLocator.evaluate((node) =>
    Array.from(node.options)
      .map((option) => ({
        value: option.value,
        label: option.textContent || "",
      }))
      .filter(
        (option) =>
          String(option.value || "").trim().length > 0 &&
          !/^select\b/i.test(option.label.trim()) &&
          !/^no\s/i.test(option.label.trim()),
      ),
  );

  if (!options.length) {
    throw new Error("No selectable option was available.");
  }

  await selectLocator.selectOption(options[0].value);
  return options[0].value;
}

async function waitForSelectableOptions(selectLocator, minimumCount = 2) {
  await expect
    .poll(async () => selectLocator.evaluate((node) => node.options.length))
    .toBeGreaterThanOrEqual(minimumCount);
}

test.describe("Specialized operations testing", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
  });

  test("reports module handles report-type switching and filter/search controls", async ({
    page,
  }) => {
    await page.goto("/reports");

    await expect(
      page.getByRole("heading", { name: "Reports built for faster daily decisions" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Last 7 days" })).toBeVisible();

    await page.getByRole("button", { name: "Last 7 days" }).click();
    await expect(page.getByText(/Rows:/)).toBeVisible();

    await page
      .getByRole("button", { name: /Banquet\s+Events, halls and settlement/i })
      .click();
    await expect(page.getByText("Hall", { exact: true }).first()).toBeVisible();

    const searchBox = page.getByPlaceholder(
      "Search guest, hall, source, payment mode, amount...",
    );
    await searchBox.fill("Grand Ballroom");
    await expect(searchBox).toHaveValue("Grand Ballroom");

    await page.getByRole("button", { name: "Refresh Reports" }).click();
    await expect(page.getByText("Insight Snapshot")).toBeVisible();
  });

  test("banquet module opens reservation and hall management tools", async ({ page }) => {
    await page.goto("/banquet");

    await expect(page.getByText("Manage banquet reservations").first()).toBeVisible();
    await expect(page.getByText("Live banquet health")).toBeVisible();

    await page.getByRole("button", { name: "New reservation" }).click();
    await expect(page.getByRole("heading", { name: "Add banquet reservation" })).toBeVisible();
    await expect(page.getByPlaceholder("Enter guest name")).toBeVisible();
    await expect(page.getByPlaceholder("Enter mobile number")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).last().click();

    await page.getByRole("button", { name: "Banquet Halls" }).click();
    await page.getByRole("button", { name: "Add Hall" }).click();
    await expect(page.getByRole("heading", { name: "Add Hall" })).toBeVisible();
    await expect(page.getByPlaceholder("Hall name")).toBeVisible();
    await expect(page.getByPlaceholder("Capacity")).toBeVisible();
    await expect(page.getByPlaceholder("Rate per hour")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).last().click();
  });

  test("assignments module can create and delete a targeted task", async ({ page }) => {
    const taskName = `PW specialized task ${Date.now()}`;

    await page.goto("/assignments");

    await expect(page.getByText("Assignment operations board")).toBeVisible();
    await expect(page.getByText("Assign task with priority and timing")).toBeVisible();

    const staffSelect = page.locator('select[name="staff_name"]');
    const roomSelect = page.locator('select[name="room_number"]');

    await expect(page.getByText(/assignable staff loaded/i)).toBeVisible();
    await expect(page.getByText(/current rooms loaded/i)).toBeVisible();

    await waitForSelectableOptions(staffSelect);
    await waitForSelectableOptions(roomSelect);

    const currentStaffValue = await staffSelect.inputValue();
    if (!currentStaffValue || /^select\b/i.test(currentStaffValue)) {
      await selectFirstNonEmptyOption(staffSelect);
    }

    await roomSelect.selectOption({ index: 1 });
    await page.locator('select[name="priority"]').selectOption("High");
    await page.locator('input[name="task"]').fill(taskName);
    await page.locator('textarea[name="notes"]').fill("Specialized automation coverage");
    await page.getByRole("button", { name: "Assign Task" }).click();

    const row = page.locator("tr").filter({ hasText: taskName });
    const singleRow = row.first();
    await expect(singleRow).toBeVisible();
    await singleRow.getByRole("button", { name: "Delete" }).click();
    await expect(row).toHaveCount(0);
  });

  test("housekeeping module switches between board and cleaning log views", async ({
    page,
  }) => {
    await page.goto("/housekeeping");

    await expect(
      page.getByText("Manage rooms, assignments, amenities, inspections & more"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Room Board/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cleaning Log/i })).toBeVisible();

    await page.getByRole("button", { name: /Cleaning Log/i }).click();
    await expect(page.getByText("Live cleaning alerts")).toBeVisible();
    await expect(page.getByPlaceholder("Search by room no or type")).toBeVisible();

    const searchBox = page.getByPlaceholder("Search by room no or type");
    await searchBox.fill("101");
    await expect(searchBox).toHaveValue("101");

    await page.getByRole("button", { name: /Room Board/i }).click();
    await expect(page.getByRole("button", { name: "Add Room" })).toBeVisible();
  });
});
