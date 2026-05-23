/**
 * Helper for sending template-driven WhatsApp messages via WASend.
 * Reads credentials, templates and toggles from fb_owner_sms_* tables.
 * Falls back to .env if DB is empty. All errors are swallowed and logged
 * so a failed WhatsApp send never blocks the main API response.
 */
const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const safeFetch =
  global.fetch ||
  (async (...args) => {
    const undici = require("undici");
    return undici.fetch(...args);
  });

const getSettings = async () => {
  try {
    const rows = await runQuery(
      "SELECT * FROM fb_owner_sms_settings ORDER BY id ASC LIMIT 1",
    );
    return rows[0] || null;
  } catch {
    return null;
  }
};

const getTemplate = async (code) => {
  try {
    const rows = await runQuery(
      "SELECT * FROM fb_owner_sms_templates WHERE code = ? LIMIT 1",
      [code],
    );
    return rows[0] || null;
  } catch {
    return null;
  }
};

const substitute = (body, vars) =>
  String(body || "").replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] != null ? String(vars[key]) : "",
  );

const sendViaWASend = async ({ username, token, number, message, fileUrl, fileName }) => {
  const url = new URL("https://wasend.sachiva.cloud/api/send-message");
  url.searchParams.set("username", username);
  url.searchParams.set("token", token);
  url.searchParams.set("number", String(number).replace(/[^0-9]/g, ""));
  url.searchParams.set("message", message);
  if (fileUrl) url.searchParams.set("file_url", fileUrl);
  if (fileName) url.searchParams.set("file_name", fileName);

  const response = await safeFetch(url.toString());
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
};

/**
 * Send a template-based WhatsApp message.
 * @param {Object} opts
 * @param {string} opts.code - template code (booking_confirmation, invoice, etc.)
 * @param {string} opts.number - recipient phone (any format; digits will be extracted)
 * @param {Object} opts.vars - placeholder substitutions ({ guest_name, room_no, amount, ... })
 * @param {string} [opts.autoFlag] - settings column name to gate the send (e.g. auto_send_booking_confirmation)
 * @param {string} [opts.fileUrl] - optional PDF URL to attach
 * @param {string} [opts.fileName] - optional filename for the attachment
 * @returns {Promise<{ok: boolean, reason?: string, response?: any}>}
 */
const sendTemplate = async ({ code, number, vars = {}, autoFlag, fileUrl, fileName }) => {
  try {
    const digits = String(number || "").replace(/[^0-9]/g, "");
    if (!digits) return { ok: false, reason: "no-recipient" };

    const settings = await getSettings();
    const username =
      (settings?.wasend_username && String(settings.wasend_username).trim()) ||
      process.env.WASEND_USERNAME;
    const token =
      (settings?.wasend_token && String(settings.wasend_token).trim()) ||
      process.env.WASEND_TOKEN;
    if (!username || !token) return { ok: false, reason: "no-credentials" };

    if (autoFlag && settings && Number(settings[autoFlag]) === 0) {
      return { ok: false, reason: `disabled-by-${autoFlag}` };
    }

    const tpl = await getTemplate(code);
    if (!tpl) return { ok: false, reason: "template-not-found" };
    if (Number(tpl.is_active) === 0) return { ok: false, reason: "template-inactive" };

    const message = substitute(tpl.body, vars);
    const response = await sendViaWASend({
      username,
      token,
      number: digits,
      message,
      fileUrl,
      fileName,
    });
    return { ok: response.status < 400, response };
  } catch (err) {
    return { ok: false, reason: err.message || String(err) };
  }
};

const getPublicBaseUrl = (req) => {
  const settings = req?._cachedSettings;
  const fromDb = settings?.public_base_url
    ? String(settings.public_base_url).trim()
    : "";
  const fromEnv = process.env.PUBLIC_BASE_URL
    ? String(process.env.PUBLIC_BASE_URL).trim()
    : "";
  const fromReq = req
    ? `${req.protocol}://${req.get("host")}`
    : "";
  return (fromDb || fromEnv || fromReq).replace(/\/$/, "");
};

module.exports = {
  sendTemplate,
  substitute,
  getSettings,
  getTemplate,
  getPublicBaseUrl,
};
