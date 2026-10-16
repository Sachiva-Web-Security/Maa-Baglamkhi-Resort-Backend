import { jest } from "@jest/globals";
import API, { getBackendBaseURL } from "../src/api.js";
import { frontendSeed } from "./fixtures/frontendSeed.js";

describe("frontend API client", () => {
  test("request interceptor injects auth and audit headers for create requests", async () => {
    localStorage.setItem("token", frontendSeed.auth.token);
    localStorage.setItem("email", frontendSeed.auth.email);

    const requestHandler = API.interceptors.request.handlers[0].fulfilled;
    const config = await requestHandler({
      method: "post",
      url: "/accounts/income",
      headers: {},
    });

    expect(config.headers.Authorization).toBe(`Bearer ${frontendSeed.auth.token}`);
    expect(config.headers["X-Audit-Action"]).toBe("create");
    expect(config.headers["X-Audit-Source"]).toBe("frontend");
    expect(config.headers["X-Audit-User-Email"]).toBe(frontendSeed.auth.email);
  });

  test("request interceptor marks login requests as login action", async () => {
    const requestHandler = API.interceptors.request.handlers[0].fulfilled;
    const config = await requestHandler({
      method: "post",
      url: "/auth/login",
      headers: {},
    });

    expect(config.headers["X-Audit-Action"]).toBe("login");
  });

  test("request interceptor respects explicit audit action override", async () => {
    const requestHandler = API.interceptors.request.handlers[0].fulfilled;
    const config = await requestHandler({
      method: "get",
      url: "/audit-logs",
      headers: {},
      auditAction: "update_profile",
    });

    expect(config.headers["X-Audit-Action"]).toBe("update_profile");
  });

  test("response interceptor clears auth and redirects on 401", async () => {
    localStorage.setItem("token", frontendSeed.auth.token);
    localStorage.setItem("role", "accountant");
    localStorage.setItem("name", "Accounts User");
    localStorage.setItem("email", frontendSeed.auth.email);
    localStorage.setItem("isAuthenticated", "true");

    const rejectedHandler = API.interceptors.response.handlers[0].rejected;

    await expect(
      rejectedHandler({
        response: { status: 401 },
        config: {},
      }),
    ).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("role")).toBeNull();
    expect(window.location.href).toBe("http://localhost:5173/login");
  });

  test("response interceptor skips redirect when skipAuthRedirect is enabled", async () => {
    localStorage.setItem("token", frontendSeed.auth.token);
    const rejectedHandler = API.interceptors.response.handlers[0].rejected;

    await expect(
      rejectedHandler({
        response: { status: 401 },
        config: { skipAuthRedirect: true },
      }),
    ).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(localStorage.getItem("token")).toBe(frontendSeed.auth.token);
    expect(window.location.href).toBe("http://localhost:5173/");
  });

  test("getBackendBaseURL strips trailing api path", () => {
    API.defaults.baseURL = "http://localhost:5002/api";
    expect(getBackendBaseURL()).toBe("http://localhost:5002");
  });

  test("getBackendBaseURL falls back to browser origin for relative base URLs", () => {
    API.defaults.baseURL = "/api";
    expect(getBackendBaseURL()).toBe(window.location.origin);
  });
});
