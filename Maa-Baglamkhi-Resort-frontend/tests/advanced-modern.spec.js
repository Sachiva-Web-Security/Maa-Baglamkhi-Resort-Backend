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

async function selectFirstRealOption(selectLocator) {
  const options = await selectLocator.evaluate((node) =>
    Array.from(node.options)
      .map((option, index) => ({
        index,
        value: option.value,
        label: option.textContent || "",
      }))
      .filter(
        (option) =>
          option.index > 0 &&
          String(option.value || "").trim().length > 0 &&
          !/^select\b/i.test(option.label.trim()) &&
          !/^no\s/i.test(option.label.trim()),
      ),
  );

  if (!options.length) {
    throw new Error("No usable option was available.");
  }

  await selectLocator.selectOption(options[0].value);
}

test.describe("Advanced modern testing", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
  });

  test("reports interactions complete without uncaught client errors", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => {
      const message = String(error);
      if (message.includes("WebSocket closed without opened")) {
        return;
      }
      pageErrors.push(message);
    });

    await page.goto("/reports");
    await expect(
      page.getByRole("heading", { name: "Reports built for faster daily decisions" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Last 30 days" }).click();
    await page
      .getByRole("button", { name: /Accounts\s+Income, expense and net flow/i })
      .click();

    const searchBox = page.getByPlaceholder(
      "Search guest, hall, source, payment mode, amount...",
    );
    await searchBox.focus();
    await page.keyboard.type("Income");
    await expect(searchBox).toHaveValue("Income");

    await page.getByRole("button", { name: "Print" }).click();
    await expect(pageErrors).toEqual([]);
  });

  test("banquet reservation modal supports escape-close and resets draft values", async ({
    page,
  }) => {
    await page.goto("/banquet");

    const guestNameInput = page.getByPlaceholder("Enter guest name");
    const mobileInput = page.getByPlaceholder("Enter mobile number");

    await page.getByRole("button", { name: "New reservation" }).click();
    await expect(page.getByRole("heading", { name: "Add banquet reservation" })).toBeVisible();

    await guestNameInput.fill("Advanced Draft Guest");
    await mobileInput.fill("9999988888");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Add banquet reservation" })).toHaveCount(0);

    await page.getByRole("button", { name: "New reservation" }).click();
    await expect(page.getByRole("heading", { name: "Add banquet reservation" })).toBeVisible();
    await expect(guestNameInput).toHaveValue("");
    await expect(mobileInput).toHaveValue("");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Add banquet reservation" })).toHaveCount(0);

    await page.getByRole("button", { name: "Reservations" }).click();
    await expect(page.getByText("Manage banquet reservations").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Manage banquet reservations").nth(1)).toHaveCount(0);
  });

  test("assignments supports edit-mode transitions and form reset", async ({ page }) => {
    const taskName = `PW advanced task ${Date.now()}`;
    const updatedTaskName = `${taskName} updated`;

    await page.goto("/assignments");
    await expect(page.getByText("Assign task with priority and timing")).toBeVisible();

    const staffSelect = page.locator('select[name="staff_name"]');
    const roomSelect = page.locator('select[name="room_number"]');

    await expect
      .poll(async () => staffSelect.evaluate((node) => node.options.length))
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(async () => roomSelect.evaluate((node) => node.options.length))
      .toBeGreaterThanOrEqual(2);

    const currentStaffValue = await staffSelect.inputValue();
    if (!currentStaffValue || /^select\b/i.test(currentStaffValue)) {
      await selectFirstRealOption(staffSelect);
    }

    await roomSelect.selectOption({ index: 1 });
    await page.locator('input[name="task"]').fill(taskName);
    await page.locator('textarea[name="notes"]').fill("Advanced automation flow");
    await page.getByRole("button", { name: "Assign Task" }).click();

    const createdRow = page.locator("tr").filter({ hasText: taskName }).first();
    await expect(createdRow).toBeVisible();
    await createdRow.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByRole("button", { name: "Update Task" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel Edit" })).toBeVisible();
    await expect(page.locator('input[name="task"]')).toHaveValue(taskName);

    await page.locator('input[name="task"]').fill(updatedTaskName);
    await page.getByRole("button", { name: "Cancel Edit" }).click();

    await expect(page.getByRole("button", { name: "Assign Task" })).toBeVisible();
    await expect(page.locator('input[name="task"]')).toHaveValue("");

    await createdRow.getByRole("button", { name: "Delete" }).click();
    await expect(createdRow).toHaveCount(0);
  });

  test("housekeeping board and log preserve their own filter state", async ({ page }) => {
    await page.goto("/housekeeping");

    const boardRoomFilter = page.getByPlaceholder("Room no");
    await boardRoomFilter.fill("101");
    await expect(boardRoomFilter).toHaveValue("101");

    await page.getByRole("button", { name: /Cleaning Log/i }).click();
    const logSearch = page.getByPlaceholder("Search by room no or type");
    await expect(logSearch).toHaveValue("");
    await logSearch.fill("201");
    await expect(logSearch).toHaveValue("201");

    await page.getByRole("button", { name: /Room Board/i }).click();
    await expect(boardRoomFilter).toHaveValue("101");
    await page.getByRole("button", { name: /Cleaning Log/i }).click();
    await expect(logSearch).toHaveValue("201");
  });
});
