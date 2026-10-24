/**
 * port-scanner.js — quick tool to find which port the eSSL machine is
 * actually listening on. Run it ON the PC that's on the same network as
 * the eSSL device (the one running timeTrackLite).
 *
 * Usage:
 *   node port-scanner.js 192.168.1.201
 *   node port-scanner.js 192.168.1.201 4350,4351,4001,23
 */
const net = require("net");

const host = process.argv[2] || "192.168.1.201";
const customPorts = process.argv[3]
  ? process.argv[3].split(",").map(Number)
  : [
      // eSSL01 / Securoid family defaults
      4350, 4351, 4352,
      // ZKTeco-style (many eSSL devices are rebranded)
      4350,
      // Common Telnet
      23,
      // Sometimes 4001 or 4000
      4001, 4000,
      // HTTP control
      80, 8080, 8443,
      // A few others
      5000, 5001, 6000, 6001, 7000, 7001, 8888, 9000, 9001, 9600, 10000,
    ];

console.log(`\nScanning ${host} — ${customPorts.length} ports\n`);

(async () => {
  const open = [];
  for (const p of [...new Set(customPorts)]) {
    const result = await new Promise((resolve) => {
      const s = net.connect({ host, port: p, timeout: 1500 });
      s.on("connect", () => { s.destroy(); resolve(true); });
      s.on("timeout", () => { s.destroy(); resolve(false); });
      s.on("error", () => resolve(false));
    });
    const mark = result ? "●" : "·";
    console.log(`  ${mark}  ${p}`);
    if (result) open.push(p);
  }

  if (open.length === 0) {
    console.log(`\nNo open port found. Try one of these:`);
    console.log(`  1. In timeTrackLite, click the device row → Properties → check the port`);
    console.log(`  2. On the eSSL machine screen: Admin → Communication/Network → Telnet Port`);
    console.log(`  3. Ask IT/network team which port the eSSL is on`);
    console.log(`  4. Try custom ports: node port-scanner.js ${host} 2001,3000,4350`);
  } else {
    console.log(`\nOpen ports on ${host}: ${open.join(", ")}`);
    console.log(`Use that port number in Settings → eSSL → TCP Port, then Save & Apply.`);
  }
})();
