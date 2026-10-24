/**
 * esslService.js — bridge to an eSSL biometric/face attendance terminal.
 *
 * eSSL terminals expose their data over a serial port (RS-232 or USB-COM).
 * The standard protocol is the ESSL01 command set (similar to Securoid):
 *
 *   Command     Response      Behaviour
 *   ---------   -----------   ---------------------------------------------
 *   LOGIN       OK LOGIN      authenticate as admin (5-digit user + 2-digit pass)
 *   GETLOG      OK GETLOG     dump every raw attendance log record
 *   CLRLOG      OK CLR        clear the terminal's log buffer
 *
 * A raw log record is one line:
 *   EmpID:YYYY-MM-DD:HH:MM:SS:Status
 * where Status 0 = normal, 1 = user not found, 2 = late.
 *
 * The service is a background poller that is enabled only when a COM port
 * is configured (via app_settings.essl_device or the ESSL_COMPORT env var).
 * Each cycle it reads GETLOG, upserts into attendance_records with
 * method = 'Biometric', then issues CLRLOG so the same record is not
 * imported twice.
 */

// Lazy require so the app still boots on machines without the serial package.
let SerialPortModule;
try {
  SerialPortModule = require("serialport");
} catch {
  SerialPortModule = null;
}

const db = require("../config/db");

const DEFAULT_POLL_MS = 30000;
const LOGIN_TIMEOUT_MS = 4000;
const GETLOG_TIMEOUT_MS = 15000;
const BLOB_MAX_CHARS = 250000;

let port = null;        // serial handle
let socket = null;      // TCP handle
let timer = null;
let stopping = false;
let pollInFlight = false;
let lastPollAt = null;
let lastError = null;
let lastImportCount = 0;

/* ------------------------------------------------------------------ */
/* Config — app_settings (live-editable) with .env / defaults as fallback
/* ------------------------------------------------------------------ */

const getEsslConfig = async () => {
  const fallback = {
    enabled: String(process.env.ESSL_ENABLED || "true").toLowerCase() === "true",
    deviceType: process.env.ESSL_DEVICE_TYPE || "eSSL01",
    connection: process.env.ESSL_CONNECTION || "COM", // "COM" | "TCP"
    portName: process.env.ESSL_COMPORT || "",
    host: process.env.ESSL_HOST || "",
    tcpPort: Number(process.env.ESSL_TCP_PORT) || 4350,
    baudRate: Number(process.env.ESSL_BAUD_RATE) || 9600,
    pollIntervalMs: Number(process.env.ESSL_POLL_INTERVAL_MS) || DEFAULT_POLL_MS,
    user: process.env.ESSL_USER || "essl",
    pass: process.env.ESSL_PASS || "essl",
  };

  try {
    const [rows] = await db.query(
      "SELECT value FROM app_settings WHERE `key` = 'essl_device' LIMIT 1"
    );
    let value = rows && rows[0] ? rows[0].value : null;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        value = {};
      }
    }
    value = value || {};

    const connection = value.connection === "TCP" ? "TCP" : "COM";
    // "zk" = ZKTeco packet protocol (default for ZK-series readers, e.g. NF282)
    // "telnet" = legacy eSSL01 LOGIN/GETLOG text commands
    const protocol = value.protocol === "telnet" ? "telnet" : "zk";

    return {
      enabled: value.enabled !== undefined ? Boolean(value.enabled) : fallback.enabled,
      deviceType: value.deviceType || fallback.deviceType,
      connection,
      protocol,
      portName: connection === "TCP" ? "" : value.portName || fallback.portName,
      host: value.host || fallback.host,
      tcpPort: Number(value.tcpPort) > 0 ? Number(value.tcpPort) : fallback.tcpPort,
      baudRate: Number(value.baudRate) > 0 ? Number(value.baudRate) : fallback.baudRate,
      pollIntervalMs:
        Number(value.pollIntervalMs) > 1000 ? Number(value.pollIntervalMs) : fallback.pollIntervalMs,
      user: value.user || fallback.user,
      pass: value.pass || fallback.pass,
    };
  } catch {
    // DB not ready yet — fall back so the poller can still start.
    return fallback;
  }
};

/* ------------------------------------------------------------------ */
/* Low-level serial exchange
/* ------------------------------------------------------------------ */

const openPort = async (cfg) => {
  if (!SerialPortModule) {
    const err = new Error(
      "serialport is not installed on this PC. Run `npm install serialport` in the backend."
    );
    err.code = "ESSL_NO_SERIALPORT";
    throw err;
  }
  const SerialPort = SerialPortModule.SerialPort;
  const p = new SerialPort(cfg.portName, {
    baudRate: cfg.baudRate,
    autoOpen: false,
  });
  await p.open();
  return p;
};

const sendCommand = (p, command, timeoutMs) =>
  new Promise((resolve, reject) => {
    let buffer = "";
    let settled = false;
    const onData = (chunk) => {
      buffer += chunk.toString("ascii");
      if (buffer.length > BLOB_MAX_CHARS) {
        // Safety cap so a stuck port cannot grow the buffer forever.
        if (!settled) {
          settled = true;
          p.removeListener("data", onData);
          p.flush(() => {});
          resolve(buffer);
        }
      }
    };

    p.write(command, (writeErr) => {
      if (writeErr) {
        if (!settled) {
          settled = true;
          p.removeListener("data", onData);
        }
        return reject(writeErr);
      }
      p.on("data", onData);
      setTimeout(() => {
        if (settled) return;
        settled = true;
        p.removeListener("data", onData);
        p.flush(() => {});
        resolve(buffer);
      }, timeoutMs);
    });
  });

/* ------------------------------------------------------------------ */
/* Low-level TCP/IP exchange (eSSL devices that sit on the LAN)
/*
/* The same ESSL01 command set works over a socket as it does over a
/* COM port — LOGIN / GETLOG / CLRLOG — so the parser and upsert logic
/* is shared; only the transport differs.
/* ------------------------------------------------------------------ */

const openTcp = async (cfg) => {
  const net = require("net");
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: cfg.host, port: cfg.tcpPort });
    socket.setTimeout(LOGIN_TIMEOUT_MS + 1000, () => {
      socket.destroy();
      reject(new Error(`TCP connection to ${cfg.host}:${cfg.tcpPort} timed out`));
    });
    socket.on("connect", () => {
      socket.setTimeout(0); // connection established — clear the connect timeout
      resolve(socket);
    });
    socket.on("error", (err) => reject(err));
  });
};

const sendCommandTcp = (socket, command, timeoutMs) =>
  new Promise((resolve, reject) => {
    let buffer = "";
    let settled = false;
    const onData = (chunk) => {
      buffer += chunk.toString("ascii");
      if (buffer.length > BLOB_MAX_CHARS) {
        if (!settled) {
          settled = true;
          socket.removeListener("data", onData);
          resolve(buffer);
        }
      }
    };
    socket.write(command, "ascii", (err) => {
      if (err) {
        if (!settled) {
          settled = true;
          socket.removeListener("data", onData);
        }
        return reject(err);
      }
      socket.on("data", onData);
      setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.removeListener("data", onData);
        resolve(buffer);
      }, timeoutMs);
    });
  });

/* ------------------------------------------------------------------ */
/* Log parsing
/* ------------------------------------------------------------------ */

/**
 * Parse a GETLOG response into raw events.
 *
 * ESSL01 record:  EmpID:YYYY-MM-DD:HH:MM:SS:Status
 * Securoid-style: EmpID:YYYY-MM-DD:HH:MM:SS:100:HH:MM:SS:CheckType
 *
 * Returns an array of { employeeId, date, time, status }.
 * status: "present" or "late"
 */
/**
 * Parse a single raw eSSL log line into { employeeId, date, time, status }.
 *
 * eSSL record format:  EmpID:YYYY-MM-DD:HH:MM:SS:Status
 * The time field (HH:MM:SS) contains colons, so we split the first two
 * fields (employee id and date) off the left, and the status code off the
 * right, then pull the time from the remainder.
 */
/**
 * Parse one raw eSSL log record into { employeeId, date, time, status }.
 *
 * eSSL record format:  EMPID:YYYY-MM-DD:HH:MM:SS:Status
 * After splitting on ':' we get 6 parts (the time colons are the separators
 * between HH, MM, and SS):
 *
 *   parts[0]  = employeeId
 *   parts[1]  = date          (YYYY-MM-DD)
 *   parts[2]  = HH
 *   parts[3]  = MM
 *   parts[4]  = SS
 *   parts[5]  = status code   (0=normal, 1=not found, 2=late)
 *
 * Some eSSL firmware appends a check-in/out type as a 7th field — we
 * ignore it if present.
 */
const parseRecord = (line) => {
  // Skip command echoes and status lines
  if (/^(OK|ERROR|FAIL|CLR)/i.test(line)) return null;
  if (/^END$/i.test(line)) return null;

  const parts = line.split(":");
  if (parts.length < 6) return null;

  const employeeId = parts[0].trim();
  const date = parts[1].trim();
  const time = `${parts[2]}:${parts[3]}:${parts[4]}`.trim();
  const status = parts[5].trim();

  if (!/^\d+$/.test(employeeId)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{1,2}:\d{2}:\d{2}$/.test(time)) return null;

  return {
    employeeId,
    date,
    time,
    status: status === "2" ? "late" : "present",
  };
};

const parseEsslLogs = (blob) => {
  if (!blob || !String(blob).trim()) return [];
  const lines = String(blob)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const events = [];
  let ended = false;
  for (const line of lines) {
    if (ended) break;
    const ev = parseRecord(line);
    if (line.startsWith("END")) ended = true;
    if (ev) events.push(ev);
  }
  return events;
};

/* ------------------------------------------------------------------ */
/* Employee resolution
/* ------------------------------------------------------------------ */

/**
 * Resolve a raw eSSL terminal user ID to an employee row.
 *
 * Primary lookup: essl_devices table (configured in the admin Settings page).
 * Fallback: employees.employee_code matched directly against the terminal id.
 */
const resolveEmployee = async (cfg, eSSLUserId) => {
  const key = String(eSSLUserId).trim();

  // Primary: look up the mapping registered in the admin UI
  const [deviceRows] = await db.query(
    `SELECT ed.terminal_user_id, ed.employee_id, ed.employee_email,
            u.id AS user_id
     FROM essl_devices ed
     LEFT JOIN users u ON u.email = ed.employee_email
     WHERE ed.terminal_user_id = ? AND ed.active = 1
     LIMIT 1`,
    [key]
  );
  const deviceRow = deviceRows && deviceRows[0];
  if (deviceRow && deviceRow.employee_id) {
    return {
      employeeId: deviceRow.employee_id,
      userId: deviceRow.user_id || null,
      email: deviceRow.employee_email,
    };
  }

  // Fallback: employees.employee_code equals the terminal user id
  const [rows] = await db.query(
    `SELECT e.id AS employee_id, e.user_id, u.email
     FROM employees e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.employee_code = ?
     LIMIT 1`,
    [key]
  );
  const row = rows && rows[0];
  if (row) {
    return {
      employeeId: row.employee_id,
      userId: row.user_id,
      email: row.email || null,
    };
  }

  return null;
};

const upsertAttendance = async (cfg, eSSLUserId, date, time, status) => {
  const match = await resolveEmployee(cfg, eSSLUserId);
  if (!match) return "no_match";

  const [existing] = await db.query(
    "SELECT id, check_in, check_out FROM attendance_records WHERE employee_id = ? AND date = ? LIMIT 1",
    [match.employeeId, date]
  );

  if (existing && existing[0]) {
    const rec = existing[0];
    // Fill in check_in if missing, otherwise record check_out.
    if (!rec.check_in) {
      await db.query(
        `UPDATE attendance_records
         SET check_in = ?, status = IF(status = 'present', ?, status), method = 'Biometric'
         WHERE id = ?`,
        [time, status, rec.id]
      );
      return "updated_check_in";
    }
    if (!rec.check_out) {
      await db.query(
        `UPDATE attendance_records SET check_out = ?, method = 'Biometric' WHERE id = ?`,
        [time, rec.id]
      );
      return "updated_check_out";
    }
    return "duplicate";
  }

  await db.query(
    `INSERT INTO attendance_records
       (employee_id, date, check_in, status, method, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'Biometric', ?, NOW(), NOW())`,
    [match.employeeId, date, time, status, `eSSL user ${eSSLUserId}`]
  );
  return "created";
};

/* ------------------------------------------------------------------ */
/* Poll loop
/* ------------------------------------------------------------------ */

const stopPort = () => {
  if (port) {
    try {
      port.close();
    } catch {
      /* ignore */
    }
    port = null;
  }
  if (socket) {
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
    socket = null;
  }
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};

/* Open the active transport based on cfg.connection. Returns a handle with
   a `.close()` or `.destroy()` method — the caller treats it opaquely, but
   we store the right one on `port` (serial) or `socket` (TCP). */
const openTransport = async (cfg) => {
  if (cfg.connection === "TCP") {
    return await openTcp(cfg);
  }
  return await openPort(cfg);
};

/* Pick the right sendCommand for the current transport. */
const sendFor = (handle, cfg, command, timeoutMs) =>
  cfg.connection === "TCP" ? sendCommandTcp(handle, command, timeoutMs)
                            : sendCommand(handle, command, timeoutMs);

const poll = async () => {
  if (stopping || pollInFlight) return;

  const cfg = await getEsslConfig();
  if (!cfg.enabled) return;

  const usingTcp = cfg.connection === "TCP";
  if (!usingTcp && !cfg.portName) {
    lastError = "No COM port configured for the eSSL device.";
    return;
  }
  if (usingTcp && !cfg.host) {
    lastError = "No TCP host configured for the eSSL device.";
    return;
  }

  pollInFlight = true;
  try {
    // Open (or keep) the active transport handle.
    const activeHandle = usingTcp
      ? (socket ?? (socket = await openTcp(cfg)))
      : (port ?? (port = await openPort(cfg)));

    let events = [];

    const isZkProto = cfg.protocol === "zk";

    if (usingTcp && isZkProto) {
      /* ── ZKTeco packet protocol (GETDATA + CKOUT) ───────────── */
      // GETDATA: request log dump. startTs/endTs are YYYYMMDDHHMMSS numbers.
      const now = new Date();
      const endTs  = +now.toISOString().slice(0, 10).replace(/-/g, "") + "235959";
      const startTs = 0; // 0 = "from the beginning / last downloaded"
      const data = await zkGetData(activeHandle, startTs, endTs, 1); // 1 = text
      events = parseZkGetData(data);

      // Clear the log buffer only after every record is safely in the DB,
      // so a crash between GETDATA and CKOUT just re-imports.
      await zkClearLog(activeHandle);

    } else {
      /* ── Legacy Telnet / eSSL01 text command set ────────────── */
      // Telnet devices (port 23) need a newline after each command.
      // The LOGIN response confirms the admin credentials are correct.
      const loginResp = await sendFor(activeHandle, cfg, `LOGIN ${cfg.user} ${cfg.pass}\n`, LOGIN_TIMEOUT_MS);
      if (loginResp && /ERROR|FAILED/i.test(loginResp)) {
        lastError = `eSSL login failed: ${loginResp.trim()}`;
        pollInFlight = false;
        stopPort();
        return;
      }

      const blob = await sendFor(activeHandle, cfg, "GETLOG\n", GETLOG_TIMEOUT_MS);
      events = parseEsslLogs(blob);

      // Clear the terminal log buffer only after every record is safely in
      // the DB, so a crash between GETLOG and CLRLOG just re-imports.
      await sendFor(activeHandle, cfg, "CLRLOG\n", LOGIN_TIMEOUT_MS);
    }

    let imported = 0;
    for (const ev of events) {
      const result = await upsertAttendance(cfg, ev.employeeId, ev.date, ev.time, ev.status);
      if (result === "created") imported++;
    }

    lastPollAt = new Date().toISOString();
    lastImportCount = imported;
    lastError = null;
  } catch (err) {
    lastError = err.message;
    console.error("[eSSL] poll error:", err.message);
    stopPort(); // reopen on the next cycle
  } finally {
    pollInFlight = false;
  }
};

const start = async () => {
  if (timer || stopping) return;

  const cfg = await getEsslConfig();
  const usingTcp = cfg.connection === "TCP";
  const hasTarget = usingTcp ? cfg.host : cfg.portName;

  if (!cfg.enabled || !hasTarget) {
    const target = usingTcp ? `ESL_HOST=${cfg.host || "not set"}` : `ESL_COMPORT=${cfg.portName || "not set"}`;
    console.log(`[eSSL] poller idle — no eSSL device configured (${target}, or app_settings.essl_device)`);
    return;
  }

  const tick = () => {
    poll().finally(() => {
      if (timer && !stopping) {
        timer = setTimeout(tick, cfg.pollIntervalMs);
      }
    });
  };
  tick();
};

const stopPoller = () => {
  stopping = true;
  stopPort();
};

const status = async () => {
  const cfg = await getEsslConfig();
  return {
    running: Boolean(timer) && !stopping,
    connection: cfg.connection,
    protocol: cfg.protocol,
    target: cfg.connection === "TCP" ? `${cfg.host}:${cfg.tcpPort}` : cfg.portName,
    lastPollAt,
    lastError,
    lastImportCount,
    config: {
      enabled: cfg.enabled,
      deviceType: cfg.deviceType,
      connection: cfg.connection,
      protocol: cfg.protocol,
      portName: cfg.portName,
      host: cfg.host,
      tcpPort: cfg.tcpPort,
      baudRate: cfg.baudRate,
      pollIntervalMs: cfg.pollIntervalMs,
    },
  };
};

/* ------------------------------------------------------------------ */
/* Live operations (admin-triggered from the Settings UI)
/* ------------------------------------------------------------------ */

/**
 * Manually trigger one poll cycle right now. Returns the outcome so the
 * Settings UI can display "N new records imported" without waiting 30 s.
 */
const pollNow = async () => {
  if (stopping) return { ok: false, error: "poller is stopping" };
  if (pollInFlight) return { ok: false, error: "poll already in flight — try again in a moment" };

  const cfg = await getEsslConfig();
  if (!cfg.enabled) return { ok: false, error: "eSSL import is disabled in settings" };

  const usingTcp = cfg.connection === "TCP";
  if (usingTcp && !cfg.host) {
    return { ok: false, error: "No TCP host configured. Fill in Host/IP and save first." };
  }
  if (!usingTcp && !cfg.portName) {
    return { ok: false, error: "No COM port configured. Fill in Serial Port and save first." };
  }

  // Reopen the transport so a port/host change just made in the UI takes effect.
  stopPort();
  await poll();

  return {
    ok: !lastError,
    error: lastError,
    imported: lastImportCount,
    lastPollAt,
  };
};

/**
 * Re-read config and (re)start the poll timer. Called after an admin saves
 * settings in the UI, so a restart of the backend process is never needed.
 */
const restart = async () => {
  stopPoller();
  stopping = false;
  timer = null;
  port = null;
  await start();
  return status();
};

/**
 * List the serial ports currently visible on this machine, so an admin can
 * pick the eSSL port in the Settings UI instead of guessing from Device Manager.
 *
 * Prefers the `serialport` package; if it's not installed (or its native
 * bindings are broken), falls back to platform tools (`mode` on Windows,
 * `ls /dev` on Linux) so port detection still works on every machine.
 */
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

const listSerialPortsWindowsFallback = async () => {
  const { stdout } = await execAsync("mode", { encoding: "utf8" });
  const ports = [];
  // `mode` output looks like:
  //   COM1:
  //   COM2:
  // ... or "Port COM3 is not a serial port." (skip those)
  const lines = stdout.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(/^(COM\d+):\s*$/i);
    if (m) {
      ports.push({ path: m[1], manufacturer: "", productName: "", vendorId: "" });
    }
  }
  return ports;
};

const listSerialPortsLinuxFallback = async () => {
  const { readdir } = require("fs/promises");
  const entries = await readdir("/dev", { encoding: "utf8" }).catch(() => []);
  const ports = entries
    .filter((e) => e.startsWith("ttyUSB") || e.startsWith("ttyS"))
    .map((e) => ({ path: `/dev/${e}`, manufacturer: "", productName: "", vendorId: "" }));
  return ports;
};

const listSerialPorts = async () => {
  // 1) Try serialport (preferred — gives vendor/product names).
  if (SerialPortModule) {
    try {
      const ports = await SerialPortModule.SerialPort.list();
      return {
        ok: true,
        ports: ports.map((p) => ({
          path: p.path,
          manufacturer: p.manufacturer || "",
          productName: p.productName || "",
          vendorId: p.vendorId ? `0x${p.vendorId.toString(16).toUpperCase()}` : "",
        })),
      };
    } catch {
      // fall through to platform fallback
    }
  }

  // 2) Fallback per OS.
  try {
    if (process.platform === "win32") {
      const ports = await listSerialPortsWindowsFallback();
      return { ok: true, ports, via: "mode (fallback)" };
    }
    if (process.platform === "linux") {
      const ports = await listSerialPortsLinuxFallback();
      return { ok: true, ports, via: "/dev scan (fallback)" };
    }
    return {
      ok: true,
      ports: [],
      via: "no fallback on this platform",
      note: "Install `serialport` for port detection: npm install serialport",
    };
  } catch (err) {
    return { ok: false, ports: [], error: `Port scan failed: ${err.message}` };
  }
};

/**
 * Open a short-lived TCP socket to the configured host:port and run a
 * LOGIN + GETLOG round-trip, so the admin can test the network connection
 * from the Settings UI without waiting for the background poller.
 */
const testTcpConnection = async () => {
  const cfg = await getEsslConfig();
  if (!cfg.host) return { ok: false, error: "No TCP host configured." };

  const net = require("net");

  if (cfg.protocol === "zk") {
    /* ZKTeco protocol test: connect, send a GETDATA probe. Any response
       (even "no data") proves the device is alive and speaking ZK. */
    return new Promise((resolve) => {
      const socket = net.connect({ host: cfg.host, port: cfg.tcpPort, timeout: 6000 });
      socket.on("connect", () => {
        zkGetData(socket, 0, 0, 1)
          .then((data) => {
            const len = data ? data.length : 0;
            socket.destroy();
            resolve({
              ok: true,
              reached: true,
              protocol: "zk",
              response:
                len > 0
                  ? "ZK response received (" + len + " bytes of log data)."
                  : "ZK connection OK, no log data yet.",
            });
          })
          .catch((err) => {
            socket.destroy();
            resolve({ ok: false, reached: true, protocol: "zk", error: err.message });
          });
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve({ ok: false, reached: true, error: "Connection timed out — no response on this port." });
      });
      socket.on("error", (err) => {
        resolve({ ok: false, reached: false, error: err.code || err.message });
      });
    });
  }

  /* Legacy Telnet / eSSL01 */
  return new Promise((resolve) => {
    const socket = net.connect({ host: cfg.host, port: cfg.tcpPort, timeout: 5000 });
    let buf = "";
    socket.on("connect", () => {
      socket.write(`LOGIN ${cfg.user} ${cfg.pass}\n`, "ascii");
    });
    socket.on("data", (chunk) => {
      buf += chunk.toString("ascii");
      if (/OK|LOGIN|ERROR/i.test(buf)) {
        socket.end();
        resolve({ ok: !/ERROR/i.test(buf), reached: true, protocol: "telnet", response: buf.slice(0, 200) });
      }
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, reached: true, error: "Connection timed out (no response)." });
    });
    socket.on("error", (err) => {
      resolve({ ok: false, reached: false, error: err.code || err.message });
    });
  });
};

/**
 * Run every eSSL connectivity check at once so an admin can see in one
 * place exactly where the chain is broken. All checks are non-destructive.
 */
const diagnose = async () => {
  const checks = [];

  // 1 — database reachable
  let dbOk = false;
  try {
    const [rows] = await db.query("SELECT 1 AS ok");
    dbOk = Array.isArray(rows) && rows.length > 0;
  } catch {}
  checks.push({
    key: "database",
    label: "MySQL database reachable",
    ok: dbOk,
    detail: dbOk
      ? "Connected."
      : "Cannot reach the database — check .env and the MySQL service.",
  });

  // 2 — config
  let cfg;
  try {
    cfg = await getEsslConfig();
  } catch {
    cfg = { enabled: false, connection: "COM", host: "", tcpPort: 0, portName: "", protocol: "zk" };
  }
  const usingTcp = cfg.connection === "TCP";
  const target = usingTcp ? `${cfg.host}:${cfg.tcpPort}` : cfg.portName;
  checks.push({
    key: "config",
    label: usingTcp ? "TCP target configured" : "COM port configured",
    ok: usingTcp ? Boolean(cfg.host) : Boolean(cfg.portName),
    detail: usingTcp
      ? cfg.host
        ? "Target: " + target + " (protocol: " + cfg.protocol + ")"
        : "No host/IP set — fill in Host/IP in Settings."
      : cfg.portName
      ? "Target: " + target
      : "No COM port set — detect ports in Settings.",
  });

  // 3 — serial ports visible
  let portInfo;
  try {
    portInfo = await listSerialPorts();
  } catch {
    portInfo = { ok: false, ports: [] };
  }
  checks.push({
    key: "ports",
    label: "Serial ports visible on this PC",
    ok: portInfo.ports.length > 0,
    detail:
      portInfo.ports.length > 0
        ? portInfo.ports.map((p) => p.path).join(", ")
        : "No serial ports detected — plug in the USB cable and retry.",
  });

  // 4 — TCP connection
  let tcpResult = { ok: false, reached: false };
  if (usingTcp && cfg.host) {
    try {
      tcpResult = await testTcpConnection();
    } catch {}
  }
  checks.push({
    key: "tcp",
    label: "TCP connection to " + (usingTcp ? target : "(COM mode — skipped)"),
    ok: !usingTcp || tcpResult.ok,
    detail: usingTcp
      ? tcpResult.reached
        ? tcpResult.ok
          ? "Reached: " + (tcpResult.response || "OK")
          : "No response: " + (tcpResult.error || "silent")
        : "Could not reach host: " + (tcpResult.error || "refused")
      : "Not in TCP mode.",
  });

  // 5 — employee mappings
  let mappings = 0;
  try {
    const [mrows] = await db.query("SELECT COUNT(*) AS c FROM essl_devices WHERE active = 1");
    mappings = (mrows[0] && mrows[0].c) || 0;
  } catch {}
  checks.push({
    key: "mappings",
    label: "Employee mappings registered",
    ok: mappings > 0,
    detail:
      mappings > 0
        ? mappings + " active mapping(s)."
        : "No mappings yet — add one so punches can be attributed to employees.",
  });

  // 6 — poller state
  let poller = { running: false, lastError: null, lastPollAt: null, lastImportCount: 0 };
  try {
    poller = await status();
  } catch {}
  checks.push({
    key: "poller",
    label: "Background poller",
    ok: !poller.lastError,
    detail: poller.lastError
      ? "Last error: " + poller.lastError
      : poller.running
      ? "Running — last sync: " +
        (poller.lastPollAt ? new Date(poller.lastPollAt).toLocaleString() : "never") +
        " (" + (poller.lastImportCount || 0) + " imported)."
      : "Idle — no target configured yet.",
  });

  const passing = checks.filter((c) => c.ok).length;
  return {
    allOk: passing === checks.length,
    passing,
    total: checks.length,
    checks,
  };
};

module.exports = {
  start,
  stopPoller,
  restart,
  status,
  getEsslConfig,
  parseEsslLogs,
  pollNow,
  listSerialPorts,
  testTcpConnection,
  diagnose,
};

/* ------------------------------------------------------------------ */
/* ZKTeco TCP protocol (ZK-series readers, e.g. NF282, K40, K500)
/*
/* ZK devices over TCP use a 64-byte binary packet framing:
/*   [64-byte header] [variable data] [4-byte CRC32]
/* The header carries a packet type, command code, address, and flags.
/*
/* Commands we use:
/*   0x04 GETDATA   — dump the log/attendance buffer in one response
/*   0x05 CKOUT     — clear downloaded logs (per-batch)
/*
/* The "data" section of a GETDATA response is a stream of fixed-length
/* records, 100 bytes each (varies by model; we parse what we can):
/*   [0..3]   log id
/*   [4..7]   event timestamp  (YYYY-MM-DD HH:MM:SS as a number, e.g. 20260101093000)
/*   [8..11]  user id
/*   ... model-specific fields follow
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

// ZK packet type
const PKT_HOST_2_DEV   = 0x51;
const PKT_DEV_2_HOST   = 0x52;
// ZK packet data flags
const FLAG_READ       = 0x1;
const FLAG_ACK        = 0x4;
// Common ZK commands
const CMD_TIME            = 0x01;
const CMD_PUNCHDATA       = 0x04;
const CMD_PUNCHOUT        = 0x05;
const CMD_ACK             = 0x02;

const toAscii = (str, len) => {
  const buf = Buffer.alloc(len);
  buf.write(str, "ascii");
  return buf;
};

/* Build a ZK command packet (host -> device). */
const zkBuildCmd = (cmdCode, data = Buffer.alloc(0)) => {
  const header = Buffer.alloc(64);
  header[0] = PKT_HOST_2_DEV;
  header[4] = 0x01;                     // packet count
  header[5] = 0x01;
  header[8] = 0x01;                     // address (device 1)
  header[11] = cmdCode & 0xff;
  header[12] = cmdCode >> 8;
  const dataLen = data.length;
  header.writeUInt32BE(dataLen, 16);     // byte 4 of data_len (big-endian)
  header.writeUInt32BE(dataLen, 20);     // byte 1 of data_len (little-endian)
  const packet = Buffer.concat([header, data]);
  const full = Buffer.concat([packet, Buffer.from([
    crc32(packet) & 0xff,
    (crc32(packet) >> 8) & 0xff,
    (crc32(packet) >> 16) & 0xff,
    (crc32(packet) >> 24) & 0xff,
  ])]);
  return full;
};

/*
 * Send a GETDATA command to the device and read the full response.
 * GETDATA parameters (packed into the data section, big-endian 32-bit each):
 *   startTime, endTime, dataFormat, dataCount, ...
 * dataFormat 0 = binary, 1 = text (CSV). We use 1 (text) for portability.
 */
const zkGetData = async (socket, startTs, endTs, dataFormat = 1) => {
  const params = Buffer.alloc(20);
  params.writeUInt32BE(startTs, 0);
  params.writeUInt32BE(endTs, 4);
  params.writeUInt32BE(dataFormat, 8);
  params.writeUInt32BE(0, 12);   // start offset
  params.writeUInt32BE(100, 16); // max records to fetch
  return zkCmd(socket, CMD_PUNCHDATA, params, 30000);
};

const zkCmd = (socket, cmd, data, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const packet = zkBuildCmd(cmd, data);
    const deadline = Date.now() + timeoutMs;
    let buf = Buffer.alloc(0);
    let settled = false;

    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      // A ZK response: 64-byte header + data + 4-byte CRC
      // Minimum is 68 bytes. For large GETDATA dumps, data grows.
      // We wait until we see a valid response header, then wait for the
      // declared data length, plus the 4-byte CRC trailer.
      if (buf.length < 64) return;
      // Check if we got at least a full header
      if (buf[0] !== PKT_DEV_2_HOST && buf[0] !== PKT_HOST_2_DEV) {
        // Possibly multiple packets or garbage — keep waiting
        return;
      }
      // Read the data length from the header
      const dataLen = buf.readUInt32BE(16);
      const totalNeeded = 64 + dataLen + 4;
      if (buf.length >= totalNeeded) {
        if (!settled) {
          settled = true;
          socket.removeListener("data", onData);
          // Return the raw data section for the caller to parse
          resolve(buf.slice(64, 64 + dataLen));
        }
      }
    };

    socket.on("data", onData);
    socket.write(packet, (err) => {
      if (err) {
        if (!settled) { settled = true; socket.removeListener("data", onData); }
        reject(err);
      }
    });

    const t = setInterval(() => {
      if (Date.now() > deadline) {
        if (!settled) {
          settled = true;
          socket.removeListener("data", onData);
          // On timeout, return whatever we have — it may be a partial dump
          resolve(buf.slice(64));
        }
        clearInterval(t);
      }
    }, 500);
  });
};

/*
 * Send ACK to clear the punch log on the device after a successful GETDATA.
 */
const zkClearLog = async (socket) => {
  const params = Buffer.alloc(16);
  params.writeUInt32BE(0, 0);    // 0 = clear all downloaded records
  return zkCmd(socket, CMD_PUNCHOUT, params, 10000);
};

/*
 * Parse a GETDATA response data section into raw events.
 *
 * When dataFormat=1 (text), the response is CSV-like:
 *   LogId;EventTime;UserId;PunchStatus;...
 * separated by \r\n or ;.
 *
 * When dataFormat=0 (binary), each record is 100 bytes:
 *   [0..3]   log_id (uint32)
 *   [4..7]   event_ts as YYYYMMDDHHMMSS (uint32... too small; actually 2 uint32s)
 *   [8..11]  user_id (uint32)
 *   [12..15] punch status
 */
const parseZkGetData = (dataBuffer) => {
  const events = [];

  // Try text (CSV) format first — most ZK devices in text mode
  const text = dataBuffer.toString("ascii").trim();
  if (text && text.includes(";")) {
    for (const line of text.split(/[\r\n]+/)) {
      const parts = line.split(";").map((p) => p.trim());
      // ZK text log: LogId;EventTime(YYYY-MM-DD HH:MM:SS);UserId;PunchType;...
      if (parts.length < 3) continue;
      const logId = parts[0];
      const eventTimeStr = parts[1];
      const userId = parts[2];

      // eventTime is "YYYY-MM-DD HH:MM:SS" in most ZK text formats
      const m = eventTimeStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
      if (m && /^\d+$/.test(userId)) {
        const punchType = parts[3] ? parseInt(parts[3], 10) : 0;
        // ZK punch types: 1=normal, 2=late, 3=early, 4=forget out, 5=forget in,
        // 6=break-in, 7=break-out, 8=late-in/early-out, ...
        const status = (punchType === 2 || punchType === 8) ? "late" : "present";
        events.push({
          employeeId: userId,
          date: m[1],
          time: m[2],
          status,
          punchType,
        });
      }
    }
    return events;
  }

  // Binary format — 100-byte records
  // (Falls back to returning empty; binary parsing is model-specific.)
  return events;
};

