#!/usr/bin/env node
// eSSL + Payroll integration tests
const http = require("http");
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5002";
let results = [];
let cleanupFns = [];
function check(label, condition, detail) {
  const ok = Boolean(condition);
  results.push({ label, ok, detail });
  console.log("  " + (ok ? "PASS" : "FAIL") + "  " + label + (!ok && detail ? " -> " + detail : ""));
}
function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { "Content-Type": "application/json", "Connection": "close" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers, timeout: 20000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { let p; try { p = JSON.parse(data); } catch { p = data; } resolve({ status: res.statusCode, body: p }); });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("TIMEOUT")); });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}
async function getToken(email, password) {
  const r = await api("POST", "/api/auth/login", { email, password }, null);
  if (r.status !== 200) throw new Error("Login failed: " + r.status + " " + JSON.stringify(r.body));
  return r.body.token;
}
async function run() {
  let adminToken = null;
  try {
    adminToken = await getToken("admin@resort.com", "password");
  } catch (err) {
    console.log("  " + err.message + " - continuing without auth");
  }
  const month = new Date().toISOString().slice(0, 7);

  console.log("--- Auth gates ---");
  const s1 = await api("GET", "/api/attendance/essl/status", null, null);
  check("GET /essl/status no token -> 401", s1.status === 401, String(s1.status));
  const s2 = await api("GET", "/api/attendance/essl/devices", null, null);
  check("GET /essl/devices no token -> 401", s2.status === 401, String(s2.status));
  const s3 = await api("GET", "/api/salary/payroll", null, null);
  check("GET /salary/payroll no token -> 401", s3.status === 401, String(s3.status));

  console.log("--- eSSL Status ---");
  if (adminToken) {
    const st = await api("GET", "/api/attendance/essl/status", null, adminToken);
    check("GET /essl/status 200", st.status === 200, String(st.status));
    check("status has running field", st.body && st.body.running !== undefined, JSON.stringify(st.body));
    check("status has config object", st.body && typeof st.body.config === "object", "");
    check("config has portName", st.body && st.body.config && st.body.config.portName !== undefined, "");
    check("config has enabled", st.body && st.body.config && st.body.config.enabled !== undefined, "");

    console.log("--- eSSL Devices ---");
    const dl = await api("GET", "/api/attendance/essl/devices", null, adminToken);
    check("GET /essl/devices 200", dl.status === 200, String(dl.status));
    check("GET /essl/devices returns array", Array.isArray(dl.body), "");

    console.log("--- Create Mapping ---");
    const cr = await api("POST", "/api/attendance/essl/devices", { deviceName: "Test", employeeEmail: "admin@resort.com", terminalUserId: 1 }, adminToken);
    check("POST /essl/devices 201", cr.status === 201, String(cr.status) + " " + JSON.stringify(cr.body));
    if (cr.body && cr.body.id) {
      const did = cr.body.id;
      cleanupFns.push(async () => { await api("PUT", "/api/attendance/essl/devices/" + did, { active: false }, adminToken); });
      console.log("--- Disable Mapping ---");
      const dr = await api("PUT", "/api/attendance/essl/devices/" + did, { active: false }, adminToken);
      check("PUT /essl/devices/:id 200", dr.status === 200, String(dr.status) + " " + JSON.stringify(dr.body));
    }

    console.log("--- Validation ---");
    const bad = await api("POST", "/api/attendance/essl/devices", { deviceName: "X" }, adminToken);
    check("POST missing fields -> 400", bad.status === 400, String(bad.status) + " " + JSON.stringify(bad.body));
    const unk = await api("POST", "/api/attendance/essl/devices", { deviceName: "X", employeeEmail: "nope@test.com", terminalUserId: 999 }, adminToken);
    check("POST unknown email -> 404", unk.status === 404, String(unk.status) + " " + JSON.stringify(unk.body));
  }

  console.log("--- Payroll Report ---");
  if (adminToken) {
    const pr = await api("GET", "/api/salary/payroll?month=" + month, null, adminToken);
    check("GET /salary/payroll 200", pr.status === 200, String(pr.status));
    check("payroll has month", pr.body && pr.body.month !== undefined, "");
    check("payroll has employees array", pr.body && Array.isArray(pr.body.employees), "");
    check("payroll has summary", pr.body && typeof pr.body.summary === "object", "");
    check("summary has totalEarnedPay", pr.body && pr.body.summary && pr.body.summary.totalEarnedPay !== undefined, "");
    if (pr.body && pr.body.employees && pr.body.employees.length > 0) {
      const e = pr.body.employees[0];
      check("employee has earnedPay", e.earnedPay !== undefined, "");
      check("employee has biometricDays", e.biometricDays !== undefined, "");
      check("earnedPay <= monthlySalary", e.earnedPay <= e.monthlySalary, e.earnedPay + " > " + e.monthlySalary);
    }
    const em = await api("GET", "/api/salary/payroll?month=2020-01", null, adminToken);
    check("empty month -> 200", em.status === 200, String(em.status));
    check("empty month zero earned", em.body && em.body.summary && em.body.summary.totalEarnedPay === 0, String(em.body && em.body.summary));
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log("=== " + passed + "/" + results.length + " passed, " + failed + " failed ===");
  for (const r of results) { if (!r.ok) console.log("  FAIL: " + r.label + (r.detail ? " -> " + r.detail : "")); }
  for (const fn of cleanupFns.reverse()) { try { await fn(); } catch {} }
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
