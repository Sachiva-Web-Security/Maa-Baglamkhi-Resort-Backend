const db = require("../config/db");
const esslService = require("../services/esslService");

/**
 * GET /api/attendance/essl/status
 * Returns the live state of the eSSL poller plus the effective config.
 */
exports.getStatus = async (req, res) => {
  try {
    const cfg = await esslService.getEsslConfig();
    const poller = await esslService.status();
    res.json({
      running: poller.running,
      connection: poller.connection,
      target: poller.target,
      lastPollAt: poller.lastPollAt,
      lastImportCount: poller.lastImportCount,
      lastError: poller.lastError,
      config: poller.config || {
        enabled: cfg.enabled,
        deviceType: cfg.deviceType,
        connection: cfg.connection,
        portName: cfg.portName,
        host: cfg.host,
        tcpPort: cfg.tcpPort,
        baudRate: cfg.baudRate,
        pollIntervalMs: cfg.pollIntervalMs,
        user: cfg.user,
        pass: cfg.pass,
      },
    });
  } catch (err) {
    console.error("[esslController.getStatus]", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/attendance/essl/devices
 * List all registered eSSL devices and their employee mappings.
 */
exports.getDevices = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ed.*, e.first_name AS employee_first, e.last_name AS employee_last
       FROM essl_devices ed
       LEFT JOIN employees e ON e.id = ed.employee_id
       ORDER BY ed.device_name, ed.terminal_user_id`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/attendance/essl/devices
 * Register a device/employee mapping.
 *
 * Body: {
 *   deviceName,  serialNumber?, connection?, baudRate?,
 *   employeeId?, employeeEmail, terminalUserId,
 * }
 *
 * Either employeeId (numeric DB id) or employeeEmail must be provided.
 * When only employeeEmail is given, the employee row is resolved from the
 * users + employees tables and the id is filled in automatically.
 */
exports.createDevice = async (req, res) => {
  const {
    deviceName,
    serialNumber,
    connection = "COM",
    baudRate = 9600,
    employeeId,
    employeeEmail,
    terminalUserId,
  } = req.body || {};

  if (!employeeEmail || !terminalUserId) {
    return res.status(400).json({
      message: "employeeEmail and terminalUserId are required",
    });
  }

  try {
    // Resolve employee_id from the email when not supplied explicitly
    let resolvedEmployeeId = employeeId;
    if (!resolvedEmployeeId) {
      const [userRows] = await db.query(
        "SELECT id AS user_id FROM users WHERE email = ? LIMIT 1",
        [employeeEmail]
      );
      if (!userRows || !userRows[0]) {
        return res.status(404).json({
          message: `No user found with email "${employeeEmail}". Create the user first.`,
        });
      }
      const [empRows] = await db.query(
        "SELECT id FROM employees WHERE user_id = ? LIMIT 1",
        [userRows[0].user_id]
      );
      if (!empRows || !empRows[0]) {
        return res.status(404).json({
          message: `No employee record is linked to user "${employeeEmail}".`,
        });
      }
      resolvedEmployeeId = empRows[0].id;
    }

    const [result] = await db.query(
      `INSERT INTO essl_devices
         (device_name, serial_number, connection, baud_rate, employee_id,
          employee_email, terminal_user_id, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        deviceName || "eSSL",
        serialNumber || null,
        connection,
        Number(baudRate) || 9600,
        Number(resolvedEmployeeId),
        employeeEmail,
        Number(terminalUserId),
      ]
    );
    res.status(201).json({ id: result.insertId, message: "Device registered" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "That terminal_user_id is already registered for another employee",
      });
    }
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/attendance/essl/poll
 * Admin only: force one sync cycle right now (instead of waiting for the next 30 s tick).
 */
exports.pollNow = async (req, res) => {
  try {
    const result = await esslService.pollNow();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

/**
 * POST /api/attendance/essl/test-tcp
 * Admin only: open a short-lived socket to the configured host:port, send LOGIN,
 * and return what the device responds. Confirms the eSSL is reachable over the LAN
 * without waiting for the background poller.
 */
exports.testTcp = async (req, res) => {
  try {
    const result = await esslService.testTcpConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

/**
 * POST /api/attendance/essl/diagnose
 * Admin only: run every connectivity check at once and return a checklist.
 */
exports.diagnose = async (req, res) => {
  try {
    const result = await esslService.diagnose();
    res.json(result);
  } catch (err) {
    res.status(500).json({ allOk: false, checks: [], error: err.message });
  }
};

/**
 * POST /api/attendance/essl/raw-dump
 * Admin only: connect to the device, send a ReadPunch command, and return
 * the raw response bytes as hex + ASCII. Use this when parsing returns 0
 * events but the connection is alive, to inspect the actual firmware response.
 */
exports.rawDump = async (req, res) => {
  try {
    const cfg = await esslService.getEsslConfig();
    const result = await esslService.rawZkDump(cfg);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

/**
 * POST /api/attendance/essl/restart
 * Admin only: re-read config and restart the poll timer after the admin saved settings.
 */
exports.restart = async (req, res) => {
  try {
    const st = await esslService.restart();
    res.json({ message: "eSSL poller restarted with latest settings", ...st });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/attendance/essl/ports
 * List serial ports visible on this machine (admin picks the eSSL port in the Settings UI).
 */
exports.listPorts = async (req, res) => {
  try {
    const result = await esslService.listSerialPorts();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, ports: [], error: err.message });
  }
};

/**
 * PUT /api/attendance/essl/devices/:id
 * Deactivate a mapping (soft delete).
 */
exports.disableDevice = async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE essl_devices SET active = 0 WHERE id = ?",
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Device not found" });
    }
    res.json({ message: "Device deactivated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
