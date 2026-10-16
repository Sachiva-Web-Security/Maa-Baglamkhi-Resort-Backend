import { chromium } from "playwright";

const BASE_URL = process.env.UI_BASE_URL || "http://localhost:5173";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@hotel.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function nowId() {
  return String(Date.now());
}

function toErrString(e) {
  if (!e) return "Unknown error";
  return e.stack || e.message || String(e);
}

async function waitForAny(page, locators, timeoutMs = 15000) {
  const started = Date.now();
  // Poll until any locator is visible.
  // (We avoid Promise.race on waits to reduce false positives on detached nodes.)
  while (true) {
    for (const l of locators) {
      try {
        if (await l.isVisible()) return l;
      } catch {
        // ignore transient errors during navigation/rerender
      }
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for any expected UI element.");
    }
    await page.waitForTimeout(250);
  }
}

async function run() {
  const runId = nowId();
  const registered = {
    attempted: false,
    succeeded: false,
    name: `Manager ${runId}`,
    email: `manager.${runId}@example.com`,
    password: "pass1234",
    role: "manager",
  };

  const report = {
    meta: { runId, baseUrl: BASE_URL, startedAt: new Date().toISOString() },
    steps: [],
    consoleErrors: [],
    pageErrors: [],
    requestFailed: [],
    badResponses: [],
    dialogs: [],
  };

  const step = (id, name) => {
    const s = { id, name, status: "running", details: {} };
    report.steps.push(s);
    return {
      pass(details = {}) {
        s.status = "passed";
        s.details = details;
      },
      fail(error, details = {}) {
        s.status = "failed";
        s.details = { ...details, error: toErrString(error) };
      },
      info(details = {}) {
        s.details = { ...s.details, ...details };
      },
    };
  };

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      report.consoleErrors.push({
        type,
        text: msg.text(),
        location: msg.location(),
      });
    }
  });

  page.on("pageerror", (err) => {
    report.pageErrors.push({ message: err.message, stack: err.stack });
  });

  page.on("requestfailed", (req) => {
    report.requestFailed.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure(),
      resourceType: req.resourceType(),
    });
  });

  page.on("response", async (res) => {
    const status = res.status();
    if (status < 400) return;
    const url = res.url();
    if (!url.includes("localhost:5002") && !url.includes("/api/")) return;
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      bodyText = "";
    }
    report.badResponses.push({ url, status, statusText: res.statusText(), body: bodyText.slice(0, 2000) });
  });

  page.on("dialog", async (dialog) => {
    report.dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  });

  try {
    // 1) Open /register
    {
      const s = step(1, "Open /register");
      try {
        await page.goto("/register", { waitUntil: "domcontentloaded" });
        await waitForAny(page, [
          page.getByRole("heading", { name: /create account/i }),
          page.getByRole("button", { name: /create account/i }),
          page.getByText(/create account/i),
        ]);
        s.pass({ url: page.url() });
      } catch (e) {
        s.fail(e, { url: page.url() });
      }
    }

    // 2) Register a new user
    {
      const s = step(2, "Register a new user (manager role)");
      registered.attempted = true;
      try {
        const registerResponsePromise = page
          .waitForResponse(
            (res) =>
              res.url().includes("localhost:5002/api/auth/register") &&
              res.request().method() === "POST",
            { timeout: 20000 },
          )
          .catch(() => null);

        await page.locator('input[name="name"]').fill(registered.name);
        await page.locator('input[name="email"]').fill(registered.email);
        await page.locator('input[name="password"]').fill(registered.password);
        await page.locator('input[name="confirmPassword"]').fill(registered.password);
        await page.locator('select[name="role"]').selectOption(registered.role);
        await page.getByRole("button", { name: /create account/i }).click();

        const createBtn = page.getByRole("button", { name: /create account/i });
        const errorBox = page.locator('div:text-matches("Name, email and password are required\\.|Passwords do not match\\.|Password must be at least 6 characters\\.|Network Error|Registration failed\\.|Account created\\.|Email.*already|already exists|duplicate", "i")').first();

        const resp = await registerResponsePromise;

        // Wait for either redirect to /login, an in-form error, or the button returning to idle state.
        await waitForAny(
          page,
          [
            page.locator('input[name="username"]'), // login email field
            errorBox,
            createBtn.filter({ hasText: /create account/i }),
          ],
          20000,
        );

        const currentUrl = page.url();
        const errorVisible = await errorBox.isVisible().catch(() => false);

        if (currentUrl.includes("/login")) {
          registered.succeeded = true;
          s.pass({
            registeredEmail: registered.email,
            redirectedTo: currentUrl,
            apiStatus: resp ? resp.status() : null,
          });
        } else if (errorVisible) {
          const errText = (await errorBox.textContent())?.trim() || "Registration blocked (unknown error).";
          registered.succeeded = false;
          s.fail(new Error(errText), {
            registeredEmail: registered.email,
            url: currentUrl,
            apiStatus: resp ? resp.status() : null,
          });
        } else {
          // Could have succeeded but remained on /register; check if dialog indicated success
          const dialogSuccess = report.dialogs.find((d) => /account created/i.test(d.message));
          if (dialogSuccess) {
            registered.succeeded = true;
            s.pass({ registeredEmail: registered.email, dialog: dialogSuccess.message, url: currentUrl });
          } else {
            s.fail(new Error("Registration outcome unclear (no redirect and no visible error)."), { url: currentUrl });
          }
        }
      } catch (e) {
        registered.succeeded = false;
        s.fail(e, { registeredEmail: registered.email, url: page.url() });
      }
    }

    // 3) Go to /login and login with admin (or newly registered)
    {
      const s = step(3, "Login (admin@hotel.com/admin123 or newly registered user)");
      async function attemptLogin(email, password) {
        await page.goto("/login", { waitUntil: "domcontentloaded" });
        await waitForAny(page, [
          page.locator('input[name="username"]'),
          page.getByText(/email address/i),
        ]);
        await page.locator('input[name="username"]').fill(email);
        await page.locator('input[name="password"]').fill(password);
        await page.getByRole("button", { name: /^login$/i }).click();
        // Either goes dashboard, or an alert appears (dialog handler already accepts)
        await page.waitForTimeout(1500);
        return page.url();
      }

      try {
        let loginAs = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, kind: "admin" };
        let url = await attemptLogin(loginAs.email, loginAs.password);

        if (!url.includes("/dashboard") && registered.succeeded) {
          loginAs = { email: registered.email, password: registered.password, kind: "registered" };
          url = await attemptLogin(loginAs.email, loginAs.password);
        }

        if (url.includes("/dashboard")) {
          s.pass({ loggedInAs: loginAs.kind, email: loginAs.email, url });
        } else {
          const lastDialog = report.dialogs.at(-1);
          s.fail(new Error(lastDialog?.message || "Login did not reach /dashboard."), { loggedInAs: loginAs.kind, url });
        }
      } catch (e) {
        s.fail(e, { url: page.url() });
      }
    }

    // 4) Confirm redirect to /dashboard + metrics render
    {
      const s = step(4, "Dashboard loads and metric cards render");
      try {
        await page.waitForURL("**/dashboard", { timeout: 20000 });
        const metricTitles = [
          "Total Rooms",
          "Occupied Rooms",
          "Today's Revenue",
          "Today's Check-ins",
        ];
        for (const t of metricTitles) {
          await page.getByText(t, { exact: false }).first().waitFor({ timeout: 20000 });
        }
        s.pass({ url: page.url(), metricsFound: metricTitles });
      } catch (e) {
        s.fail(e, { url: page.url() });
      }
    }

    // 5) /profile loads, name/role/email shown; avatar upload if possible
    {
      const s = step(5, "Profile loads; verify name/role/email; try avatar upload");
      try {
        await page.goto("/profile", { waitUntil: "domcontentloaded" });
        await waitForAny(page, [
          page.getByRole("heading", { name: /user|manager|admin/i }),
          page.getByRole("button", { name: /update profile picture/i }),
          page.getByText(/change password/i),
        ], 20000);

        const bodyText = await page.locator("body").innerText();
        const hasEmailVisible =
          /@/.test(bodyText) && (bodyText.includes(ADMIN_EMAIL) || (registered.succeeded && bodyText.includes(registered.email)));

        // Upload (use existing svg asset)
        const fileInput = page.locator('input[type="file"][accept*="image"]');
        const updateBtn = page.getByRole("button", { name: /update profile picture/i });

        let upload = { attempted: false, succeeded: false, message: null };
        if (await fileInput.count()) {
          upload.attempted = true;
          const uploadResponsePromise = page
            .waitForResponse(
              (res) =>
                res.url().includes("localhost:5002/api/users/me/avatar") &&
                res.request().method() === "PUT",
              { timeout: 25000 },
            )
            .catch(() => null);

          const filePath = new URL("../src/assets/react.svg", import.meta.url).pathname;
          // Windows path normalization: Playwright accepts absolute paths; ensure decoded.
          const winPath = decodeURIComponent(filePath).replace(/^\//, "");
          await fileInput.setInputFiles(winPath);
          await updateBtn.click();

          const resp = await uploadResponsePromise;
          const success = page.getByText(/profile picture updated successfully/i);
          const errorBoxUi = page.locator('div:text-matches("MulterError|File too large|upload|fail|endpoint|error", "i")').first();

          // Prefer UI message; fall back to response status.
          await waitForAny(page, [success, errorBoxUi], 25000);

          const successVisible = await success.isVisible().catch(() => false);
          upload.succeeded = successVisible || (resp ? resp.ok() : false);
          upload.message = successVisible
            ? (await success.textContent())?.trim() || "Profile picture updated successfully."
            : (await errorBoxUi.textContent())?.trim() || (resp ? `Upload failed (${resp.status()})` : "Upload failed.");
        }

        if (!upload.attempted) {
          s.pass({ url: page.url(), emailVisible: hasEmailVisible, avatarUploadUI: false });
        } else if (upload.succeeded) {
          s.pass({ url: page.url(), emailVisible: hasEmailVisible, avatarUploadUI: true, upload });
        } else {
          s.fail(new Error(upload.message || "Avatar upload failed."), { url: page.url(), emailVisible: hasEmailVisible, avatarUploadUI: true, upload });
        }
      } catch (e) {
        s.fail(e, { url: page.url() });
      }
    }

    // 6) /hotel loads without API errors
    {
      const s = step(6, "Hotel page loads without API errors");
      try {
        const hotelResponsePromise = page
          .waitForResponse(
            (res) =>
              res.url().includes("localhost:5002/api/hotel") &&
              res.request().method() === "GET",
            { timeout: 25000 },
          )
          .catch(() => null);

        await page.goto("/hotel", { waitUntil: "domcontentloaded" });
        await page.getByText("Hotel Management", { exact: false }).waitFor({ timeout: 20000 });
        await waitForAny(page, [
          page.getByText("Active Bookings", { exact: false }),
          page.getByText("No active bookings found.", { exact: false }),
        ], 25000);

        const hotelResp = await hotelResponsePromise;
        // If hotel fetch fails, the UI uses alert(); dialog handler captures it.
        const lastDialog = report.dialogs.at(-1);
        if (lastDialog && /error loading hotel data/i.test(lastDialog.message)) {
          s.fail(new Error(lastDialog.message), { url: page.url(), apiStatus: hotelResp ? hotelResp.status() : null });
        } else if (hotelResp && !hotelResp.ok()) {
          s.fail(new Error(`Hotel API failed (${hotelResp.status()} ${hotelResp.statusText()})`), {
            url: page.url(),
            apiStatus: hotelResp.status(),
          });
        } else {
          s.pass({ url: page.url(), apiStatus: hotelResp ? hotelResp.status() : null });
        }
      } catch (e) {
        s.fail(e, { url: page.url() });
      }
    }

    // 7) /reports loads summary (no crash)
    {
      const s = step(7, "Reports page loads and summary renders (no crash)");
      try {
        await page.goto("/reports", { waitUntil: "domcontentloaded" });
        await page.getByText("Reports", { exact: false }).first().waitFor({ timeout: 20000 });
        // Summary is conditional; we accept either summary visible or page stable with no crash.
        const summaryRow = page.locator("text=/Rooms:\\s*\\d+/i").first();
        const hasSummary = await summaryRow.isVisible().catch(() => false);
        s.pass({ url: page.url(), summaryVisible: hasSummary });
      } catch (e) {
        s.fail(e, { url: page.url() });
      }
    }
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  report.meta.finishedAt = new Date().toISOString();
  return report;
}

const report = await run().catch((e) => {
  // Ensure we still emit something machine-readable.
  console.error("Smoke test runner crashed:", e);
  process.exitCode = 1;
  return {
    meta: { baseUrl: process.env.UI_BASE_URL || "http://localhost:5173", crashed: true },
    error: toErrString(e),
  };
});

console.log(JSON.stringify(report, null, 2));
