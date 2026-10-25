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
let udpServer = null;  // UDP real-time listener
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
    tcpPort: Number(process.env.ESSL_TCP_PORT) || 4370,
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
      // Real-time push: the K80 can send each punch to our UDP port as it happens,
      // in addition to the periodic TCP GETDATA poll.
      // udpHost = the IP of the PC running this backend (e.g. 192.168.1.38).
      // Leave empty to disable the real-time listener.
      realtimeEnabled: value.realtimeEnabled !== undefined
        ? Boolean(value.realtimeEnabled)
        : String(process.env.ESSL_REALTIME || "true").toLowerCase() === "true",
      udpHost: value.udpHost || process.env.ESSL_UDP_HOST || "",
      udpPort: Number(value.udpPort) > 0
        ? Number(value.udpPort)
        : Number(process.env.ESSL_UDP_PORT) || 4000,
      commKey: Number(value.commKey) || 0,
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
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners("error");
      fn(arg);
    };
    socket.setTimeout(LOGIN_TIMEOUT_MS + 1000, () => {
      finish(reject, new Error(`TCP connection to ${cfg.host}:${cfg.tcpPort} timed out`));
      socket.destroy();
    });
    socket.on("connect", () => {
      socket.setTimeout(0); // connection established — clear the connect timeout
      finish(resolve, socket);
    });
    socket.on("error", (err) => finish(reject, err));
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
      /* ── ZKTeco packet protocol (ReadPunch + ClearLog) ───────── */
      // ReadPunch: fetch up to 100 records from offset 0 (= last cleared).
      // The device returns a Buffer of raw 40-byte ZK punch records.
      const data = await zkReadPunch(activeHandle, 0, 100);
      events = parseZkGetData(data);

      // Clear the log buffer only after every record is safely in the DB,
      // so a crash between ReadPunch and ClearLog just re-imports.
      // Wrap in try/catch so a ClearLog failure (device dropped the
      // connection after ReadPunch, for example) doesn't mask the import.
      try {
        await zkClearLog(activeHandle);
      } catch (clrErr) {
        console.warn("[eSSL] ClearLog failed (will re-import next cycle):", clrErr.message);
      }

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

  // Start the UDP real-time listener (catches punches between TCP polls)
  await startUdpListener(cfg);
};

/* ------------------------------------------------------------------ */
/* Real-time UDP listener — the K80 pushes punches to this port when
/* it is configured in timeTrackLite / on-device to use "Client Mode"
/* with a server IP + port.  Each punch arrives as a 356-byte packet:
/*   [4]  PKT_DEV_2_HOST (0x52)
/*   [5]  0x01
/*   [8]  0x01
/*   [11] CMD_PUNCHDATA (0x04)
/*   [12] 0x00
/*   [16..19]  data length (BE)  — 34 for a single punch record
/*   [20..53]  punch data section (the 356-byte body)
/*   [54..57]  CRC-32 (little-endian)
/*
/* The punch record section (offset 16 in the header, 34 bytes):
/*   [0..3]   logId
/*   [4..7]   userId
/*   [8..11]  timestamp — BCD-encoded: 0x20 0x26 0x01 0x15 0x08 0x30 0x00 0x00
/*             (= 2026-01-25 08:30:00).  Bytes: year-2000, month, day, hour, min, sec, pad, pad
/*   [12..15] status (0x01=normal, 0x02=late, ...)
/*   [16..19] badge (0)
/*   [20..23] verifyMode
/*   [24..27] 0
/*   [28..31] 0
/* ------------------------------------------------------------------ */

const bcdToNumber = (buf, start) => {
  // ZK BCD: upper nibble = decade, lower nibble = unit
  return (buf[start] >> 4) * 10 + (buf[start] & 0x0f);
};

const parseZkPunchPacket = (data) => {
  // data = the full packet received from the UDP socket
  if (!data || data.length < 64) return null;

  // Verify it looks like a ZK punch packet
  if (data[4] !== 0x52 && data[4] !== 0x51) return null;

  // The punch data starts at byte 16 of the header, 34 bytes long
  const userId = data.readUInt32BE(16 + 4);   // offset 20
  const tsStart = 16 + 8;                    // offset 24

  // ZK timestamp BCD encoding (8 bytes):
  //   byte0: (year-2000)/10  byte1: (year-2000)%10
  //   byte2: month/10        byte3: month%10
  //   byte4: day/10          byte5: day%10
  //   byte6: hour/10         byte7: hour%10
  // Actually ZK uses a simpler BCD:
  //   year = data[tsStart], month = data[tsStart+1], day = data[tsStart+2]
  //   hour = data[tsStart+3], min  = data[tsStart+4], sec = data[tsStart+5]
  // Each byte is BCD (upper 4 bits = tens, lower 4 bits = ones)
  const year  = 2000 + (data[tsStart] & 0xff);
  const month = data[tsStart + 1] & 0xff;
  const day   = data[tsStart + 2] & 0xff;
  const hour  = data[tsStart + 3] & 0xff;
  const min   = data[tsStart + 4] & 0xff;
  const sec   = data[tsStart + 5] & 0xff;
  const punchStatus = data[tsStart + 12] & 0xff;

  if (!userId || !year || !month) return null;

  const pad2 = (n) => String(n).padStart(2, "0");
  return {
    employeeId: String(userId),
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    time: `${pad2(hour)}:${pad2(min)}:${pad2(sec)}`,
    status: punchStatus === 2 || punchStatus === 8 ? "late" : "present",
    punchStatus,
  };
};

const startUdpListener = async (cfg) => {
  if (!cfg.realtimeEnabled || !cfg.udpPort) return;
  if (udpServer) return; // already started

  const dgram = require("dgram");
  udpServer = dgram.createSocket("udp4");
  udpServer.on("message", async (msg) => {
    const ev = parseZkPunchPacket(msg);
    if (!ev) return;
    try {
      const result = await upsertAttendance(cfg, ev.employeeId, ev.date, ev.time, ev.status);
      if (result === "created") lastImportCount++;
      console.log(`[eSSL] real-time punch: user=${ev.employeeId} ${ev.date} ${ev.time} (${result})`);
    } catch (err) {
      console.error("[eSSL] real-time upsert failed:", err.message);
    }
  });
  udpServer.on("error", (err) => {
    console.error("[eSSL] UDP listener error:", err.message);
    udpServer = null;
  });
  udpServer.bind(cfg.udpPort, () => {
    console.log(`[eSSL] UDP real-time listener on port ${cfg.udpPort}`);
  });
};

const stopUdpListener = () => {
  if (udpServer) {
    try { udpServer.close(); } catch {}
    udpServer = null;
  }
};

const stopPoller = () => {
  stopping = true;
  stopPort();
  stopUdpListener();
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
      realtimeEnabled: cfg.realtimeEnabled,
      udpHost: cfg.udpHost,
      udpPort: cfg.udpPort,
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
  stopPoller(); // also closes the UDP listener
  stopping = false;
  timer = null;
  port = null;
  socket = null;
  await start(); // start() re-opens TCP and re-binds UDP
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
    /*
     * ZK protocol handshake test:
     *  1. Open a fresh socket (don't reuse the poller's).
     *  2. Send a GetInfo command (0x341) — the safest probe.
     *  3. If the device replies with a valid ZK packet, report success.
     *  4. If the connection resets (ECONNRESET), report it as a protocol
     *     mismatch — the K80 likely needs a different comm-key or the
     *     ZK TCP server mode may not be fully enabled on the firmware.
     *  5. If rawHex=true, also return the first 128 response bytes as hex
     *     so the user can share them for protocol debugging.
     */
    const rawHex = process.env.ESSL_DEBUG_RAW === "1";
    return new Promise((resolve) => {
      const connectTime = Date.now();
      const socket = net.connect({ host: cfg.host, port: cfg.tcpPort });
      let buf = Buffer.alloc(0);
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearInterval(watchdog);
        try { socket.destroy(); } catch {}
        if (rawHex && buf.length > 0) {
          result.rawHex = buf.slice(0, 128).toString("hex");
          result.rawHexLen = buf.length;
        }
        resolve(result);
      };

      socket.on("connect", () => {
        const probe = zkBuildCmd(CMD_GETINFO, Buffer.alloc(4).writeUInt32LE(1, 0));
        socket.write(probe, (err) => {
          if (err) finish({ ok: false, reached: true, protocol: "zk", error: "write failed: " + err.message });
        });
      });

      socket.on("data", (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        // A valid ZK response has a 24-byte header; dataLen tells us the rest.
        if (buf.length >= 24) {
          const dataLen = buf.readUInt32LE(11);
          const totalNeeded = 24 + dataLen + 4;
          if (buf.length >= totalNeeded) {
            const cmd = buf.readUInt32LE(15);
            const pktType = buf.readUInt32LE(19);
            finish({
              ok: true,
              reached: true,
              protocol: "zk",
              response:
                "ZK handshake OK — cmd=0x" + cmd.toString(16) +
                ", dataLen=" + dataLen +
                ", pktType=0x" + pktType.toString(16),
            });
          }
        }
      });

      socket.on("error", (err) => {
        // ECONNRESET on connect or mid-handshake means the device closed
        // the TCP connection — usually a protocol or comm-key mismatch.
        finish({
          ok: false,
          reached: buf.length > 0,
          protocol: "zk",
          error: err.code || err.message,
          hint:
            err.code === "ECONNRESET"
              ? "Device closed the connection. Check that ZK TCP server mode is enabled on the K80, " +
                "and that the comm-key matches (try 0x00000000 first). " +
                "Run with ESSL_DEBUG_RAW=1 to capture raw response bytes."
              : undefined,
        });
      });

      socket.setTimeout(8000, () => {
        finish({
          ok: false,
          reached: buf.length > 0,
          protocol: "zk",
          error: "No ZK handshake within 8 s (received " + buf.length + " bytes).",
          hint: buf.length > 0
            ? "Received bytes but no valid ZK response. If ESSL_DEBUG_RAW=1, inspect rawHex."
            : "No bytes received — confirm the K80 ZK TCP server is running on port 4370.",
        });
      });

      const watchdog = setInterval(() => {
        // Safety: force-resolve if something hangs indefinitely.
        if (Date.now() - connectTime > 12000) finish({ ok: false, error: "watchdog timeout" });
      }, 3000);
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

/**
 * Raw hex dump of the last ZK ReadPunch response, for protocol debugging.
 * Call this from the Settings UI "raw dump" button when normal parsing
 * returns 0 events but the connection is alive.
 */
const rawZkDump = async (cfg) => {
  const net = require("net");
  if (!cfg || !cfg.host) return { ok: false, error: "No host configured." };

  return new Promise((resolve) => {
    const socket = net.connect({ host: cfg.host, port: cfg.tcpPort || 4370 });
    let buf = Buffer.alloc(0);
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch {}
      resolve(result);
    };

    socket.on("connect", () => {
      // Send a ReadPunch command for 1 record — smallest possible probe
      const body = zkBuildReadPunchBody(0, 1);
      const probe = zkBuildCmd(CMD_READ_PUNCH, body);
      socket.write(probe, (err) => {
        if (err) finish({ ok: false, error: "write failed: " + err.message });
      });
    });

    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      // Collect up to 512 bytes then stop — enough to see 1 full ZK response
      if (buf.length >= 512) finish({
        ok: true,
        hex: buf.toString("hex"),
        ascii: buf.toString("latin1").replace(/[^\x20-\x7e]/g, "?"),
        byteCount: buf.length,
      });
    });

    socket.on("error", (err) => finish({ ok: false, error: err.code || err.message }));
    socket.setTimeout(10000, () => finish({
      ok: buf.length > 0,
      hex: buf.toString("hex"),
      ascii: buf.toString("latin1").replace(/[^\x20-\x7e]/g, "?"),
      byteCount: buf.length,
      error: buf.length === 0 ? "timeout — no data received" : undefined,
    }));
  });
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
  rawZkDump,
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

/*
 * ZK protocol uses CRC-32 (IEEE 802.3):
 *   - init: 0x00000000
 *   - no reflection
 *   - no final XOR
 * This differs from the standard zlib CRC-32 (init 0xFFFFFFFF, final XOR).
 */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c >>> 0;
  }
  return t;
})();

const crc32zk = (buf) => {
  let crc = 0; // ZK uses 0 initial, no final XOR
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc >>> 0;
};

// ── ZK protocol constants ──────────────────────────────────────────────
// ZK uses a 24-byte packet header. Layout:
//   byte 0:   0x51 (Host→Device) / 0x52 (Device→Host)
//   byte 1:   0x01
//   byte 2:   0x01
//   byte 3-6:  comm key (little-endian; usually 0x00000000)
//   byte 7-10: address (little-endian; usually 0x00000001)
//   byte 11-14: data length (little-endian, = body byte count)
//   byte 15-18: command type (little-endian)
//   byte 19-22: packet type  (0x01 = command, 0x02 = ack, 0x04 = read data)
//   byte 23:   0x00
// Then the body (dataLen bytes), then a 4-byte CRC-32 (little-endian).
//
// IMPORTANT: command codes here are the *TCP command word*, which differs
// from the raw sub-packet codes. ReadPunch = 0x32100 (not 0x04).

const PKT_HOST_2_DEV   = 0x51;
const PKT_DEV_2_HOST   = 0x52;
const PKT_TYPE_CMD     = 0x01;
const PKT_TYPE_ACK     = 0x02;
const PKT_TYPE_DATA    = 0x04;
const CMD_READ_PUNCH   = 0x32100;   // ReadPunch — get attendance log records
const CMD_READ_STATUS  = 0x32102;   // ReadStatus — get device status
const CMD_CLEAR_LOG    = 0x33302;   // ClearLog (CKOUT) — clear downloaded records
const CMD_GETINFO      = 0x341;     // GetInfo — safe first probe (device info)
const CMD_ACK          = 0x0002;    // ACK response packet type

/* Build a ZK command packet: 24-byte header + body + 4-byte CRC. */
const zkBuildCmd = (cmdCode, body = Buffer.alloc(0), pktType = PKT_TYPE_CMD, commKey = 0, address = 1) => {
  const header = Buffer.alloc(24);
  header[0] = PKT_HOST_2_DEV;
  header[1] = 0x01;
  header[2] = 0x01;
  header.writeUInt32LE(commKey >>> 0, 3);       // bytes 3-6
  header.writeUInt32LE(address >>> 0, 7);       // bytes 7-10
  header.writeUInt32LE(body.length >>> 0, 11);  // bytes 11-14: data length
  header.writeUInt32LE(cmdCode >>> 0, 15);      // bytes 15-18: command
  header.writeUInt32LE(pktType >>> 0, 19);      // bytes 19-22: packet type
  header[23] = 0x00;

  const packet = Buffer.concat([header, body]);
  const full = Buffer.concat([packet, Buffer.alloc(4)]);
  full.writeUInt32LE(crc32zk(packet) >>> 0, 24 + body.length);
  return full;
};

/*
 * Build the GETDATA body: 20 bytes of big-endian params.
 *   startTs, endTs (YYYYMMDDHHMMSS as uint32, 0 = all)
 *   0x10001 = read-punch-data flag
 *   startOffset (0 = from last cleared)
 *   maxCount
 */
const zkBuildGetDataBody = (startTs, endTs, startOffset = 0, maxCount = 100) => {
  const b = Buffer.alloc(20);
  b.writeUInt32BE(startTs, 0);
  b.writeUInt32BE(endTs, 4);
  b.writeUInt32BE(0x10001, 8);   // flag: read punch data
  b.writeUInt32BE(startOffset, 12);
  b.writeUInt32BE(maxCount, 16);
  return b;
};

/**
 * ReadPunch (0x32100) body — 20 bytes, all little-endian:
 *   [0..3]   startOffset   (0 = from last cleared log)
 *   [4..7]   maxCount      (max records to return this call)
 *   [8..11]  0x10001       (flag: include punch data, not just status)
 *   [12..15] 0
 *   [16..19] 0
 * Timestamps are NOT sent in ReadPunch; the device returns records
 * in chronological order from startOffset.
 */
const zkBuildReadPunchBody = (startOffset = 0, maxCount = 100) => {
  const b = Buffer.alloc(20);
  b.writeUInt32LE(startOffset, 0);
  b.writeUInt32LE(maxCount, 4);
  b.writeUInt32LE(0x10001, 8);
  return b;
};

/*
 * Sends a ZK TCP command and reads the full response (header + body + CRC).
 * Resolves with the response body Buffer, or an empty Buffer on timeout.
 * Rejects only on socket error (ECONNRESET, ECONNREFUSED, write-after-destroy).
 */
const zkCmd = (socket, cmd, body, timeoutMs) => {
  return new Promise((resolve, reject) => {
    if (socket.destroyed) {
      reject(new Error("socket is already destroyed — reopen the connection"));
      return;
    }
    const packet = zkBuildCmd(cmd, body);
    const deadline = Date.now() + timeoutMs;
    let buf = Buffer.alloc(0);
    let settled = false;

    const settle = (val, fn = resolve) => {
      if (settled) return;
      settled = true;
      clearInterval(t);
      socket.removeListener("data", onData);
      socket.removeListener("error", onErr);
      fn(val);
    };

    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      // A ZK response is: 24-byte header + dataLen bytes + 4-byte CRC.
      // We need at least 24 bytes before we can read dataLen.
      if (buf.length < 24) return;
      const dataLen = buf.readUInt32LE(11);
      const totalNeeded = 24 + dataLen + 4;
      if (buf.length >= totalNeeded) {
        // Verify the byte-0 marker looks like a ZK response (0x52 = D2H).
        // Some firmwares reply with 0x51 even for responses.
        const pktType = buf.readUInt32LE(19);
        if (pktType === PKT_TYPE_ACK || pktType === PKT_TYPE_DATA || dataLen === 0) {
          settle(buf.slice(24, 24 + dataLen));
        }
      }
    };

    const onErr = (err) => {
      // ECONNRESET / ECONNREFUSED / ERR_STREAM_DESTROYED — fail the command
      settle(err, reject);
    };

    socket.on("data", onData);
    socket.on("error", onErr);
    socket.write(packet, (err) => {
      if (err) settle(err, reject);
    });

    const t = setInterval(() => {
      if (Date.now() > deadline) settle(Buffer.alloc(0));
    }, 500);
  });
};

/* ReadPunch — returns up to maxCount attendance records as a raw Buffer. */
const zkReadPunch = async (socket, startOffset = 0, maxCount = 100) => {
  const body = zkBuildReadPunchBody(startOffset, maxCount);
  return zkCmd(socket, CMD_READ_PUNCH, body, 30000);
};

/*
 * ClearLog (CKOUT, 0x33302) — tells the device the punch buffer can be
 * cleared now that the records have been read. Body is 4 bytes of 0x01.
 */
const zkClearLog = async (socket) => {
  const body = Buffer.alloc(4);
  body.writeUInt32LE(1, 0);
  return zkCmd(socket, CMD_CLEAR_LOG, body, 10000);
};

/*
 * GetInfo probe — safest first command on an unknown ZK device.
 * Body is 4 bytes: 0x00000001 (returns device info string).
 */
const zkGetInfo = async (socket) => {
  const body = Buffer.alloc(4);
  body.writeUInt32LE(1, 0);
  return zkCmd(socket, CMD_GETINFO, body, 10000);
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
/**
 * Parse a ZK GETDATA binary response into attendance events.
 *
 * ZK "ReadPunch" records are 40 bytes each:
 *   [0..3]   logId
 *   [4..7]   userId
 *   [8..11]  timestamp (raw, varies by firmware — see bcdTimestamp fallback)
 *   [12..15] status (1=normal, 2=late, 3=early, 4=forget-out, 5=forget-in,
 *                   6=break-in, 7=break-out, 8=late-in/early-out)
 *   [16..19] badge
 *   [20..23] verifyMode
 *   [24..27] 0
 *   [28..31] 0
 *   [32..35] 0
 *   [36..39] 0
 *
 * The K80/eSSL ZLM60 firmware sometimes returns text (CSV-like) when
 * dataFormat=1 is requested. We handle both:
 */
const parseZkGetData = (dataBuffer) => {
  const events = [];
  if (!dataBuffer || dataBuffer.length === 0) return events;

  // ── Try text mode first (some ZK builds return semicolon-delimited CSV) ──
  const text = dataBuffer.toString("ascii").trim();
  if (text.includes(";") && text.includes(",")) {
    for (const line of text.split(/[\r\n]+/)) {
      const parts = line.split(";").map((p) => p.trim());
      if (parts.length < 4) continue;
      // Typical: LogId;EventTime;UserId;PunchStatus
      const m = (parts[1] || "").match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
      if (m && /^\d+$/.test(parts[2] || "")) {
        const punchType = parseInt(parts[3] || "0", 10);
        events.push({
          employeeId: parts[2],
          date: m[1],
          time: m[2],
          status: punchType === 2 || punchType === 8 ? "late" : "present",
          punchType,
        });
      }
    }
    return events;
  }

  // ── Binary mode: 40-byte ZK ReadPunch records ─────────────────────────────
  // Layout (all multi-byte integers are LITTLE-ENDIAN):
  //   [0..3]   logId
  //   [4..7]   userId
  //   [8..11]  timestamp  — 8 bytes: year(1) month(1) day(1) hour(1) min(1) sec(1) [pad pad]
  //             year is offset from 2000 (e.g. 0x06 = 2006).  Some firmwares
  //             store it as a BCD value (0x06 = 6 → 2006) instead.
  //   [12..15] status  (0=unknown, 1=normal/OK, 2=late, 3=early, 4=forget-out, ...)
  //   [16..19] badge
  //   [20..23] verifyMode
  //   [24..39] reserved / zero
  const RECORD_LEN = 40;
  const numRecords = Math.floor(dataBuffer.length / RECORD_LEN);

  // Heuristic: the ZLM60 K80 firmware uses BCD for year-2000 offset, while
  // standard ZK firmwares use plain integers.  We detect which by checking
  // whether the year byte looks like BCD (upper nibble < 3, lower nibble < 10).
  const firstRecordYearByte = numRecords > 0 ? dataBuffer[8] : 0;
  const yearOffset = (b) => {
    // BCD: upper nibble = tens digit, lower nibble = ones digit
    // Plain: the byte is the offset from 2000 directly
    const bcdVal = ((b >> 4) & 0x0f) * 10 + (b & 0x0f);
    // If the byte looks like a valid BCD encoding of a year offset (< 100),
    // prefer BCD.  Otherwise treat as plain integer.
    return bcdVal <= 100 ? bcdVal : b;
  };

  for (let i = 0; i < numRecords; i++) {
    const off = i * RECORD_LEN;
    const userId = dataBuffer.readUInt32LE(off + 4);
    if (!userId) continue;

    const yearOff = yearOffset(dataBuffer[off + 8]);
    const year  = 2000 + yearOff;
    const month = dataBuffer[off + 9];
    const day   = dataBuffer[off + 10];
    const hour  = dataBuffer[off + 11];
    const min   = dataBuffer[off + 12];
    const sec   = dataBuffer[off + 13];
    const status  = dataBuffer.readUInt32LE(off + 12 + 4); // status is at offset 12..15
    const punchStatus = status & 0xff;

    // Sanity-check: skip records with impossible dates or zero timestamps
    if (month < 1 || month > 12 || day < 1 || day > 31 || yearOff > 100) continue;

    const pad = (n) => String(n).padStart(2, "0");
    events.push({
      employeeId: String(userId),
      date: `${year}-${pad(month)}-${pad(day)}`,
      time: `${pad(hour)}:${pad(min)}:${pad(sec)}`,
      status: punchStatus === 2 || punchStatus === 8 ? "late" : "present",
      punchType: punchStatus,
      raw: dataBuffer.slice(off, off + RECORD_LEN).toString("hex"),
    });
  }

  return events;
};

