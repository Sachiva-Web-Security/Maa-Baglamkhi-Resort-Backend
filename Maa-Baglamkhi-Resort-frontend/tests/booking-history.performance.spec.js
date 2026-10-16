import { expect, test } from "playwright/test";

async function loginAsReception(page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("reception@resort.com");
  await page.locator('input[type="password"]').fill("password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/reception-dashboard$/, { timeout: 30_000 });
}

async function waitForBookingHistoryUi(page) {
  await page.waitForFunction(
    () =>
      Boolean(document.querySelector("article")) ||
      document.body.innerText.includes(
        "Abhi tak koi checked-out booking history me nahi hai.",
      ),
    { timeout: 15_000 },
  );
}

async function collectPerformanceMetrics(page, renderReadyMs, apiResponseMs) {
  return page.evaluate(
    ({ measuredRenderReadyMs, measuredApiResponseMs }) => {
      const navigationEntry = performance.getEntriesByType("navigation")[0];
      const recordBadge =
        document.body.innerText.match(/\b\d+\s+records\b/i)?.[0] || null;

      return {
        renderReadyMs: measuredRenderReadyMs,
        apiResponseMs: measuredApiResponseMs,
        domContentLoadedMs: navigationEntry
          ? Math.round(navigationEntry.domContentLoadedEventEnd)
          : null,
        loadEventMs: navigationEntry
          ? Math.round(navigationEntry.loadEventEnd)
          : null,
        articleCount: document.querySelectorAll("article").length,
        emptyStateVisible: document.body.innerText.includes(
          "Abhi tak koi checked-out booking history me nahi hai.",
        ),
        recordBadge,
      };
    },
    {
      measuredRenderReadyMs: renderReadyMs,
      measuredApiResponseMs: apiResponseMs,
    },
  );
}

test.describe("Booking history performance baseline", () => {
  test("loads booking history within the initial baseline", async ({ page }) => {
    test.slow();

    await loginAsReception(page);

    const navigationStartedAt = Date.now();
    let apiResponseMs = null;
    const historyResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/hotel/booking-history"),
    );

    await page.goto("/hotel/booking-history");

    const historyResponse = await historyResponsePromise;
    apiResponseMs = Date.now() - navigationStartedAt;
    expect(historyResponse.ok()).toBeTruthy();

    await expect(
      page.getByRole("heading", { name: "Checked-out bookings archive" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Archived guest stays" }),
    ).toBeVisible();
    await waitForBookingHistoryUi(page);

    const renderReadyMs = Date.now() - navigationStartedAt;
    const metrics = await collectPerformanceMetrics(
      page,
      renderReadyMs,
      apiResponseMs,
    );

    await test.info().attach("booking-history-performance.json", {
      body: Buffer.from(JSON.stringify(metrics, null, 2)),
      contentType: "application/json",
    });

    console.log(
      `BOOKING_HISTORY_PERF ${JSON.stringify(metrics)}`,
    );

    expect(metrics.renderReadyMs).toBeLessThan(15_000);
    expect(metrics.apiResponseMs).toBeLessThan(15_000);
    expect(metrics.domContentLoadedMs).not.toBeNull();
    expect(metrics.domContentLoadedMs).toBeGreaterThan(0);
    expect(metrics.domContentLoadedMs).toBeLessThan(8_000);
    expect(metrics.loadEventMs).not.toBeNull();
    expect(metrics.loadEventMs).toBeGreaterThan(0);
    expect(metrics.loadEventMs).toBeLessThan(12_000);
  });
});
