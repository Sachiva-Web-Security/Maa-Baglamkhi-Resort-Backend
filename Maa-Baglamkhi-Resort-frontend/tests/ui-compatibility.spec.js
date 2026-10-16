import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", size: { width: 1440, height: 900 } },
  { name: "tablet", size: { width: 1024, height: 768 } },
  { name: "mobile", size: { width: 390, height: 844 } },
];

const routes = [
  {
    path: "/reports",
    readyText: "Reports built for faster daily decisions",
  },
  {
    path: "/banquet",
    readyText: "Manage banquet reservations",
  },
  {
    path: "/assignments",
    readyText: "Assignment operations board",
  },
  {
    path: "/housekeeping",
    readyText: "Manage rooms, assignments, amenities, inspections & more",
  },
];

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

async function collectPageCompatibility(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentScrollWidth: doc.scrollWidth,
      documentClientWidth: doc.clientWidth,
      bodyScrollWidth: body ? body.scrollWidth : null,
      bodyClientWidth: body ? body.clientWidth : null,
      horizontalOverflowPx: Math.max(doc.scrollWidth - doc.clientWidth, 0),
      hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 2,
    };
  });
}

test.describe("UI compatibility baseline", () => {
  for (const viewport of viewports) {
    test(`${viewport.name} viewport renders reports, banquet, assignments and housekeeping`, async ({
      page,
    }) => {
      test.slow();
      await page.setViewportSize(viewport.size);
      await loginAsManager(page);

      for (const route of routes) {
        await page.goto(route.path);
        await expect(page.getByText(route.readyText, { exact: true })).toBeVisible();

        const compatibility = await collectPageCompatibility(page);

        await test.info().attach(
          `${viewport.name}-${route.path.replaceAll("/", "_") || "root"}-compatibility.json`,
          {
            body: Buffer.from(JSON.stringify(compatibility, null, 2)),
            contentType: "application/json",
          },
        );

        expect(compatibility.hasHorizontalOverflow).toBeFalsy();
      }
    });
  }
});
