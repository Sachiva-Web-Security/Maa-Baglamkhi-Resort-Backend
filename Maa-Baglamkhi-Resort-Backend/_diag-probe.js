const http = require("http");
function post(p, b) {
  return new Promise((res) => {
    const d = JSON.stringify(b);
    const r = http.request(
      { host: "127.0.0.1", port: 5002, path: p, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": d.length } },
      (s) => {
        let x = "";
        s.on("data", (c) => (x += c));
        s.on("end", () => res([s.statusCode, x]));
      }
    );
    r.write(d);
    r.end();
  });
}
function get(p, auth, withRole) {
  return new Promise((res) => {
    const r = http.request(
      { host: "127.0.0.1", port: 5002, path: p, headers: { ...(auth ? { Authorization: "Bearer " + auth } : {}) } },
      (s) => {
        let x = "";
        s.on("data", (c) => (x += c));
        s.on("end", () => res([s.statusCode, x.slice(0, 200)]));
      }
    );
    r.end();
  });
}
(async () => {
  const [cs, body] = await post("/api/auth/login", { email: "admin@resort.com", password: "password" });
  let tok, role, name;
  try {
    const j = JSON.parse(body);
    tok = j.token || (j.data && j.data.token);
    const payload = JSON.parse(Buffer.from(tok.split(".")[1], "base64").toString());
    role = payload.role;
    name = payload.name;
  } catch (e) {}
  console.log("login", cs, "role in JWT:", JSON.stringify(role), "user:", name);
  const [c1, g1] = await get("/api/employees/departments", tok);
  console.log("/api/employees/departments:", c1, g1.slice(0, 80));
  const [c2, g2] = await get("/api/attendance?date=2026-10-24", tok);
  console.log("/api/attendance?date:", c2, g2.slice(0, 80));
  const [c3, g3] = await get("/api/accounts", tok);
  console.log("/api/accounts:", c3, g3.slice(0, 80));
  const [c4, g4] = await get("/api/chef", tok);
  console.log("/api/chef:", c4, g4.slice(0, 80));
  const [c5, g5] = await get("/api/dashboard/charts", tok);
  console.log("/api/dashboard/charts:", c5, g5.slice(0, 80));
})();
