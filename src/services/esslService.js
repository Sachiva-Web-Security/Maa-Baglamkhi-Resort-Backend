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

let port = null;
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
    portName: process.env.ESSL_COMPORT || "",
    baudRate: Number(process.env.ESSL_BAUD_RATE) || 9600,
    pollIntervalMs: Number(process.env.ESSL_POLL_INTERVAL_MS) || DEFAULT_POLL_MS,
    user: process.env.ESSL_USER || "00000",
    pass: process.env.ESSL_PASS || "00",
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

    return {
      enabled: value.enabled !== undefined ? Boolean(value.enabled) : fallback.enabled,
      deviceType: value.deviceType || fallback.deviceType,
      portName: value.portName || fallback.portName,
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
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};

const poll = async () => {
  if (stopping || pollInFlight) return;

  const cfg = await getEsslConfig();
  if (!cfg.enabled) return;
  if (!cfg.portName) {
    lastError = "No COM port configured for the eSSL device.";
    return;
  }

  pollInFlight = true;
  try {
    if (!port) {
      port = await openPort(cfg);
    }

    // Login (required before GETLOG on most eSSL models)
    const loginResp = await sendCommand(port, `LOGIN ${cfg.user} ${cfg.pass}`, LOGIN_TIMEOUT_MS);
    if (loginResp && /ERROR/i.test(loginResp)) {
      lastError = `eSSL login failed: ${loginResp}`;
      pollInFlight = false;
      return;
    }

    const blob = await sendCommand(port, "GETLOG", GETLOG_TIMEOUT_MS);
    const events = parseEsslLogs(blob);

    let imported = 0;
    for (const ev of events) {
      const result = await upsertAttendance(cfg, ev.employeeId, ev.date, ev.time, ev.status);
      if (result === "created") imported++;
    }

    // Clear the terminal log buffer only after every record is safely in
    // the DB, so a crash between GETLOG and CLRLOG just re-imports.
    await sendCommand(port, "CLRLOG", LOGIN_TIMEOUT_MS);

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
  if (!cfg.enabled || !cfg.portName) {
    console.log("[eSSL] poller idle — no eSSL device configured (set ESSL_COMPORT or app_settings.essl_device)");
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

const status = () => ({
  running: Boolean(timer) && !stopping,
  lastPollAt,
  lastError,
  lastImportCount,
});

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
  if (!cfg.portName) return { ok: false, error: "No COM port configured. Fill in Serial Port and save first." };

  // Reopen the port so admin just changed the port name in the UI — the
  // previously-open handle would be for the old port.
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
 */
const listSerialPorts = async () => {
  if (!SerialPortModule) {
    return {
      ok: false,
      ports: [],
      error:
        "serialport is not installed on this PC — run `npm install serialport` in the backend folder, then restart the backend.",
    };
  }
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
  } catch (err) {
    return { ok: false, ports: [], error: err.message };
  }
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
};
