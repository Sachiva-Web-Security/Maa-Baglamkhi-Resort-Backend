const security = require("../Maa-Baglamkhi-Resort-Backend/src/config/security");

const { isOriginAllowed } = security;

const LISTED = ["http://localhost:3000", "http://localhost:5173"];
const EXTERNAL = "https://attacker.example.com";
const LOCALHOST = "http://localhost:5173";
const LAN = "http://192.168.1.99:5173";
const LOCALHOST_ALT = "http://localhost:3000";

describe("CORS origin contract", () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  test("an origin on the list is always allowed, including in production", () => {
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed(LOCALHOST, LISTED)).toBe(true);
  });

  test("an arbitrary external origin is rejected even with an empty list in production", () => {
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed(EXTERNAL, [])).toBe(false);
  });

  test("an unlisted localhost origin is still allowed while the list is populated", () => {
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed(LOCALHOST_ALT, ["http://localhost:5173"])).toBe(false);
    expect(
      isOriginAllowed(LOCALHOST_ALT, ["http://localhost:5173"], {
        allowLocalInProduction: true,
      }),
    ).toBe(true);
    expect(
      isOriginAllowed("http://127.0.0.1:5173", ["http://localhost:5173"], {
        allowLocalInProduction: true,
      }),
    ).toBe(true);
  });

  test("the localhost exception admits private LAN hosts, not arbitrary external hosts", () => {
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed(LAN, LISTED, { allowLocalInProduction: true })).toBe(true);
    expect(isOriginAllowed("http://10.0.0.5:5173", LISTED, { allowLocalInProduction: true })).toBe(true);
    expect(
      isOriginAllowed(EXTERNAL, LISTED, { allowLocalInProduction: true }),
    ).toBe(false);
    expect(isOriginAllowed("https://192.168.1.5.example.com", LISTED, { allowLocalInProduction: true })).toBe(false);
    expect(isOriginAllowed("http://185.168.1.5:5173", LISTED, { allowLocalInProduction: true })).toBe(false);
  });

  test("without the flag, a populated list stays authoritative in production", () => {
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed(LAN, LISTED)).toBe(false);
    expect(isOriginAllowed("http://localhost:8080", LISTED)).toBe(false);
  });

  test("without the flag and with an empty list, dev keeps the localhost auto-allow", () => {
    process.env.NODE_ENV = "development";
    expect(isOriginAllowed(LAN, [])).toBe(true);
    expect(isOriginAllowed(EXTERNAL, [])).toBe(false);
  });

  test("missing or malformed origins fall back to the no-Origin behaviour", () => {
    expect(isOriginAllowed("", LISTED)).toBe(true);
    expect(isOriginAllowed(undefined, LISTED)).toBe(true);
    expect(isOriginAllowed("not a url", LISTED, { allowLocalInProduction: true })).toBe(false);
  });
});
