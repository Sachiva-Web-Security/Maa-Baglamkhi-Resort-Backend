const { api, authHeader } = require("./helpers/testRequest");
const { clearDatabase, resetAndSeedDatabase, runQuery } = require("./helpers/testDb");

describe("Auth and User APIs", () => {
  let seed;

  beforeEach(async () => {
    seed = await resetAndSeedDatabase();
  });

  describe("POST /api/auth/register", () => {
    test("registers first user when user table is empty", async () => {
      await clearDatabase();

      const res = await api().post("/api/auth/register").send({
        name: "Bootstrap Admin",
        email: "bootstrap@test.com",
        password: "Secret@123",
        role: "admin",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/registered successfully/i);
    });

    test.each([
      [{ email: "a@test.com", password: "Secret@123" }, /required/i],
      [{ name: "User", password: "Secret@123" }, /required/i],
      [{ name: "User", email: "a@test.com" }, /required/i],
    ])("rejects invalid payload %#", async (payload, message) => {
      const res = await api().post("/api/auth/register").send(payload);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(message);
    });

    test("rejects duplicate email", async () => {
      const res = await api().post("/api/auth/register").send({
        name: "Admin Again",
        email: "admin@test.com",
        password: "Secret@123",
      });

      expect([400, 403]).toContain(res.status);
    });

    test("blocks registration when users already exist", async () => {
      const res = await api().post("/api/auth/register").send({
        name: "Another User",
        email: "another@test.com",
        password: "Secret@123",
      });

      const allowRegister = String(process.env.ALLOW_REGISTER || "").toLowerCase() === "true";

      if (allowRegister) {
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/registered successfully/i);
      } else {
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/disabled/i);
      }
    });
  });

  describe("POST /api/auth/login", () => {
    test("logs in seeded admin", async () => {
      const res = await api().post("/api/auth/login").send({
        email: "admin@test.com",
        password: "Admin@123",
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.role).toBe("admin");
      expect(res.body.email).toBe("admin@test.com");
    });

    test.each([
      [{ password: "Admin@123" }, "Email and password required"],
      [{ email: "admin@test.com" }, "Email and password required"],
      [{}, "Email and password required"],
    ])("validates missing login fields %#", async (payload, expected) => {
      const res = await api().post("/api/auth/login").send(payload);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(expected);
    });

    test("rejects unknown email", async () => {
      const res = await api().post("/api/auth/login").send({
        email: "missing@test.com",
        password: "Admin@123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid email/i);
    });

    test("rejects wrong password", async () => {
      const res = await api().post("/api/auth/login").send({
        email: "admin@test.com",
        password: "Wrong@123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid password/i);
    });
  });

  describe("GET /api/users/me", () => {
    test("requires token", async () => {
      const res = await api().get("/api/users/me");
      expect(res.status).toBe(401);
    });

    test("returns current user profile", async () => {
      const res = await api()
        .get("/api/users/me")
        .set(authHeader(seed.users.admin));

      expect(res.status).toBe(200);
      expect(res.body.email).toBe("admin@test.com");
      expect(res.body.role).toBe("admin");
    });
  });

  describe("GET /api/users", () => {
    test("requires token", async () => {
      const res = await api().get("/api/users");
      expect(res.status).toBe(401);
    });

    test("returns users to authenticated caller", async () => {
      const res = await api()
        .get("/api/users")
        .set(authHeader(seed.users.manager));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("POST /api/users", () => {
    test("blocks anonymous user", async () => {
      const res = await api().post("/api/users").send({
        name: "Blocked",
        email: "blocked@test.com",
        password: "Secret@123",
        role: "staff",
      });

      expect(res.status).toBe(401);
    });

    test("blocks non-admin user", async () => {
      const res = await api()
        .post("/api/users")
        .set(authHeader(seed.users.manager))
        .send({
          name: "Blocked",
          email: "blocked@test.com",
          password: "Secret@123",
          role: "staff",
        });

      expect(res.status).toBe(403);
    });

    test("validates required fields for admin", async () => {
      const res = await api()
        .post("/api/users")
        .set(authHeader(seed.users.admin))
        .send({
          name: "Incomplete",
          email: "incomplete@test.com",
        });

      expect(res.status).toBe(400);
    });

    test("creates user for admin and returns persisted role details", async () => {
      const res = await api()
        .post("/api/users")
        .set(authHeader(seed.users.admin))
        .send({
          name: "Detail User",
          email: "detail-user@test.com",
          password: "Secret@123",
          role: "manager",
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("detail-user@test.com");
      expect(res.body.user.role).toBe("manager");
    });
  });

  describe("PUT /api/users/:id", () => {
    test("blocks manager from updating users", async () => {
      const res = await api()
        .put("/api/users/3")
        .set(authHeader(seed.users.manager))
        .send({
          name: "Changed",
          email: "changed@test.com",
          role: "staff",
        });

      expect(res.status).toBe(403);
    });

    test("validates required fields for admin update", async () => {
      const res = await api()
        .put("/api/users/3")
        .set(authHeader(seed.users.admin))
        .send({
          name: "Changed",
        });

      expect(res.status).toBe(400);
    });

    test("updates user for admin", async () => {
      const res = await api()
        .put("/api/users/3")
        .set(authHeader(seed.users.admin))
        .send({
          name: "Reception Updated",
          email: "reception-updated@test.com",
          role: "receptionist",
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("reception-updated@test.com");
    });

    test("returns 404 for missing user", async () => {
      const res = await api()
        .put("/api/users/999")
        .set(authHeader(seed.users.admin))
        .send({
          name: "Missing",
          email: "missing@test.com",
          role: "staff",
        });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/users/:id", () => {
    test("blocks manager from deleting users", async () => {
      const res = await api()
        .delete("/api/users/3")
        .set(authHeader(seed.users.manager));

      expect(res.status).toBe(403);
    });

    test("deletes user for admin", async () => {
      const res = await api()
        .delete("/api/users/5")
        .set(authHeader(seed.users.admin));

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });

    test("returns 404 when deleting unknown user", async () => {
      const res = await api()
        .delete("/api/users/999")
        .set(authHeader(seed.users.admin));

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/users/me and POST /api/users/change-password", () => {
    test("updates own profile", async () => {
      const res = await api()
        .put("/api/users/me")
        .set(authHeader(seed.users.admin))
        .send({
          name: "Admin Renamed",
          email: "admin-renamed@test.com",
        });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe("Admin Renamed");
    });

    test.each([
      [{}, 400],
      [{ currentPassword: "Admin@123" }, 400],
      [{ newPassword: "New@123" }, 400],
    ])("validates change-password payload %#", async (payload, expectedStatus) => {
      const res = await api()
        .post("/api/users/change-password")
        .set(authHeader(seed.users.admin))
        .send(payload);

      expect(res.status).toBe(expectedStatus);
    });

    test("rejects wrong current password", async () => {
      const res = await api()
        .post("/api/users/change-password")
        .set(authHeader(seed.users.admin))
        .send({
          currentPassword: "Wrong@123",
          newPassword: "NewAdmin@123",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/incorrect/i);
    });

    test("changes password successfully", async () => {
      const changeRes = await api()
        .post("/api/users/change-password")
        .set(authHeader(seed.users.admin))
        .send({
          currentPassword: "Admin@123",
          newPassword: "NewAdmin@123",
        });

      expect(changeRes.status).toBe(200);

      const loginRes = await api().post("/api/auth/login").send({
        email: "admin@test.com",
        password: "NewAdmin@123",
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeTruthy();
    });
  });

  describe("audit data side effects", () => {
    test("writes audit rows for authenticated user read routes", async () => {
      await api()
        .get("/api/users")
        .set(authHeader(seed.users.admin));

      const rows = await runQuery("SELECT COUNT(*) AS c FROM audit_logs");
      expect(Number(rows[0]?.c || 0)).toBeGreaterThan(0);
    });
  });
});
