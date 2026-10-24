/**
 * port-scanner.js — find which port the eSSL/ZKTeco machine is listening on.
 *
 * Run it ON the PC that's on the same LAN as the eSSL device:
 *
 *   node port-scanner.js 192.168.1.201
 *   node port-scanner.js 192.168.1.201 4350,4351,4001,23
 *
 * Output distinguishes OPEN / REFUSED / TIMEOUT so you can tell whether the
 * host is even reachable on that subnet.
 */
const net = require("net");

const host = process.argv[2] || "192.168.1.201";
const ports = process.argv[3]
  ? process.argv[3].split(",").map(Number)
  : [
      // ZKTeco standard Telnet
      4350, 4351, 4352, 4353,
      // eSSL / Taico variants
      4000, 4001, 4002,
      // Common Telnet
      23,
      // ZK HTTP
      80, 8080, 8443,
      // Other common
      5000, 6000, 7000, 8888, 9600, 10000,
    ];

console.log(`\nScanning ${host} on ${new Set(ports).size} ports — run this ON the PC connected to the eSSL's LAN\n`);

(async () => {
  const open = [];
  const refused = [];
  for (const p of [...new Set(ports)]) {
    const result = await new Promise((resolve) => {
      const s = net.connect({ host, port: p, timeout: 1500 });
      s.on("connect", () => { s.destroy(); resolve("OPEN"); });
      s.on("timeout", () => { s.destroy(); resolve("TIMEOUT"); });
      s.on("error", (e) => resolve(e.code === "ECONNREFUSED" ? "REFUSED" : "TIMEOUT"));
    });
    const mark = result === "OPEN" ? "●" : result === "REFUSED" ? "✗" : "·";
    console.log(`  ${mark}  ${p}  ${result === "OPEN" ? "← OPEN" : ""}`);
    if (result === "OPEN") open.push(p);
    if (result === "REFUSED") refused.push(p);
  }

  if (open.length) {
    console.log(`\nOPEN PORT(S): ${open.join(", ")}`);
    console.log(`Use ${open[0]} as the TCP Port in Settings, then Save & Apply.`);
  } else if (refused.length) {
    console.log(`\nAll ${refused.length} probed ports were REFUSED on ${host}.`);
    console.log("The host is reachable but the eSSL's server port is not in this list.");
    console.log("In eSSL timeTrackLite: click the device row → Properties → check which port it connects on.");
    console.log(`Then scan again:  node port-scanner.js ${host} <that-port>`);
  } else {
    console.log(`\nAll ports TIMED OUT — ${host} is not reachable from this PC.`);
    console.log("Check that this PC and the eSSL device are on the same subnet.");
    console.log("Run 'ipconfig' here and compare the subnet to the eSSL's IP (192.168.1.x).");
  }
})();
