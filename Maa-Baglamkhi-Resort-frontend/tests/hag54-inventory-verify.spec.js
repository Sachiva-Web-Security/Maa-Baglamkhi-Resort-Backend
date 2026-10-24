import { test, expect } from "playwright/test";

const BASE = "http://127.0.0.1:5173";
const LOG = [];
const flushLog = () => {
  for (const line of LOG) console.log(line);
  LOG.length = 0;
};
const note = (...parts) => LOG.push(`HAG54 ${parts.join(" ")}`);

test.describe.configure({ timeout: 240_000 });

async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator('input[placeholder="email@resort.com"]').waitFor({ timeout: 30_000 });
  await page.locator('input[placeholder="email@resort.com"]').fill("admin@resort.com");
  await page.locator('input[placeholder="••••••••"]').fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(3000);
  const tok = await page.evaluate(() => localStorage.getItem("token"));
  note("login:", tok ? "token stored" : "NO TOKEN");
  return tok;
}

test("inventory masters: add + delete a vendor renders real data", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const calls = [];
  const fails = [];
  page.on("pageerror", (e) => fails.push(`pageerror ${String(e.message).slice(0, 150)}`));
  page.on("response", (r) => {
    const u = r.url().replace(BASE, "").split("?")[0];
    if (u.startsWith("/api/inventory")) {
      calls.push(`${r.status()} ${r.request().method()} ${u}`);
      if (r.status() >= 400) fails.push(`${r.status()} ${r.request().method()} ${u}`);
    }
  });

  const tok = await login(page);
  expect(tok, "admin login must store a bearer token").toBeTruthy();

  const roundTrip = async (route, cfg) => {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const head = await page.getByRole("heading").filter({ hasText: cfg.heading }).count();
    note(`${cfg.label} screen renders:`, head > 0);
    const name = `HAG54 ${cfg.label} ${Date.now() % 100000}`;
    await page.getByRole("button", { name: cfg.addBtn }).first().click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder(cfg.placeholder).first().fill(name);
    if (cfg.extra) {
      await page.getByPlaceholder(cfg.extraPlaceholder).first().fill(cfg.extra);
    }
    await page.getByRole("button", { name: cfg.saveBtn }).last().click();
    await page.waitForTimeout(3000);
    const created = await page.getByText(name).count();
    note(`${cfg.label} create:`, created > 0 ? "row rendered" : "ROW NOT FOUND");
    const row = page.locator("tr").filter({ hasText: name }).first();
    await row.getByRole("button").last().click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: cfg.confirmDelBtn }).last().click();
    await page.waitForTimeout(3000);
    const removed = (await page.getByText(name).count()) === 0;
    note(`${cfg.label} delete:`, removed ? "row gone" : "STILL PRESENT");
    return { created, removed };
  };

  const vendorCfg = {
    label: "vendors",
    heading: /vendor/i,
    addBtn: /add vendor/i,
    placeholder: "e.g. Sharma Traders",
    saveBtn: /^add vendor$/i,
    confirmDelBtn: /^delete$/i,
  };
  const vendor = await roundTrip("/inventory/vendors", vendorCfg);

  const unitCfg = {
    label: "units",
    heading: /unit/i,
    addBtn: /add unit/i,
    placeholder: "e.g. Kilogram",
    extra: "kgs",
    extraPlaceholder: "e.g. kg",
    saveBtn: /^add unit$/i,
    confirmDelBtn: /delete unit/i,
  };
  const unit = await roundTrip("/inventory/units", unitCfg);

  const stockCfg = {
    label: "stock categories",
    heading: /categor/i,
    addBtn: /add category/i,
    placeholder: "e.g. Vegetables, Dairy, Spices",
    saveBtn: /^add category$/i,
    confirmDelBtn: /^delete$/i,
  };
  const stock = await roundTrip("/inventory/stock-categories", stockCfg);

  const menuCfg = {
    label: "menu categories",
    heading: /categor/i,
    addBtn: /add category/i,
    placeholder: "e.g. Starters",
    saveBtn: /^add category$/i,
    confirmDelBtn: /^delete$/i,
  };
  const menu = await roundTrip("/inventory/categories", menuCfg);

  note("api calls:", [...new Set(calls)].join(" | ") || "NONE");
  note("api failures:", JSON.stringify([...new Set(fails)]));
  await ctx.close();
  flushLog();

  expect(vendor.created, "created vendor row must render").toBeGreaterThan(0);
  expect(vendor.removed, "deleted vendor row must disappear").toBe(true);
  expect(unit.created, "created unit row must render").toBeGreaterThan(0);
  expect(unit.removed, "deleted unit row must disappear").toBe(true);
  expect(stock.created, "created stock category row must render").toBeGreaterThan(0);
  expect(stock.removed, "deleted stock category row must disappear").toBe(true);
  expect(menu.created, "created menu category row must render").toBeGreaterThan(0);
  expect(menu.removed, "deleted menu category row must disappear").toBe(true);
  expect(fails, "no 4xx/5xx from inventory APIs").toEqual([]);
});
