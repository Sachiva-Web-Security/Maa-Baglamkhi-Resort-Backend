/**
 * WhatsApp Service — Sachiva / Wasend Integration
 *
 * Sends WhatsApp messages (with optional document attachment) via the
 * Sachiva Wasend gateway:
 *   POST {WASACHIVA_URL}/api/send-message
 *
 * Auth is read from environment variables:
 *   WASACHIVA_KEY         → API token (required)
 *   WASACHIVA_URL         → Base URL of the gateway (default: https://wasend.sachiva.cloud)
 *   WASACHIVA_USERNAME    → WhatsApp account username (default: "ankit")
 *
 * Admin phone number is passed in by the caller (from the admin's profile
 * register.phone) — no settings table lookup is performed.
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

const DEFAULT_BASE_URL =
  (process.env.wasachiva_url || process.env.WASACHIVA_URL || "https://wasend.sachiva.cloud").replace(/\/+$/, "");

const API_KEY =
  process.env.wasachiva_key || process.env.WASACHIVA_KEY || "";

const FALLBACK_USERNAME =
  process.env.wasachiva_username || process.env.WASACHIVA_USERNAME || "ankit";

/**
 * Normalise a phone number to digits-only, country-code-prefixed form.
 *   "9876543210"   → "919876543210"
 *   "+91 98765..."  → "919876543210"
 *   "91-987..."     → "919876543210"
 * Returns null if the value is unusable.
 */
const normalizePhoneNumber = (raw) => {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D+/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
};

/**
 * Low-level POST against the gateway.
 */
const postToGateway = (pathname, body) => {
  const url = new URL(`${DEFAULT_BASE_URL}${pathname}`);
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;

  const payload = JSON.stringify(body);

  const options = {
    method: "POST",
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + (url.search || ""),
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      Accept: "application/json",
    },
    timeout: 15000,
  };

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const trimmed = String(data || "").trim();
        let parsed = {};
        if (trimmed) {
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            parsed = { raw: trimmed };
          }
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
          return;
        }
        const err = new Error(
          `Wasend gateway responded ${res.statusCode}: ${trimmed.slice(0, 200)}`,
        );
        err.statusCode = res.statusCode;
        err.body = parsed;
        reject(err);
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("Wasend gateway request timed out"));
    });
    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
};

/**
 * Send a WhatsApp message via the Wasend gateway.
 *
 * @param {object} options
 * @param {string} options.number       recipient phone (any format; normalised)
 * @param {string} options.message      text body
 * @param {string} [options.fileUrl]    public URL of an attachment
 * @param {string} [options.fileName]   filename to show inside WhatsApp
 * @param {string} [options.username]   optional username override (default: from env)
 * @returns {Promise<{ok:boolean, statusCode:number, response:any, number:string, channel:string}>}
 */
const sendWhatsAppMessage = async ({
  number,
  message,
  fileUrl,
  fileName,
  username,
} = {}) => {
  const normalised = normalizePhoneNumber(number);
  if (!normalised) {
    throw new Error(
      `Invalid recipient phone number for WhatsApp send: ${number}`,
    );
  }

  if (!API_KEY) {
    throw new Error(
      "wasachiva_key is not configured in environment variables",
    );
  }

  const body = {
    username: username || FALLBACK_USERNAME,
    token: API_KEY,
    number: normalised,
    message: message || "",
  };

  if (fileUrl) body.file_url = fileUrl;
  if (fileName) body.file_name = fileName;

  try {
    const response = await postToGateway("/api/send-message", body);
    return { ok: true, statusCode: 200, response, number: normalised, channel: "whatsapp" };
  } catch (err) {
    return {
      ok: false,
      statusCode: err.statusCode || 0,
      error: err.message,
      number: normalised,
      channel: "whatsapp",
    };
  }
};

/**
 * Send an SMS (text message) via the same Wasend gateway.
 */
const sendSmsMessage = async ({ number, message } = {}) => {
  const normalised = normalizePhoneNumber(number);
  if (!normalised) {
    return { ok: false, error: "Invalid phone number", number };
  }
  if (!API_KEY) {
    return { ok: false, error: "wasachiva_key not configured", number: normalised };
  }

  try {
    const response = await postToGateway("/api/send-message", {
      username: FALLBACK_USERNAME,
      token: API_KEY,
      number: normalised,
      message: message || "",
      type: "sms",
    });
    return { ok: true, statusCode: 200, response, number: normalised, channel: "sms" };
  } catch (err) {
    return {
      ok: false,
      statusCode: err.statusCode || 0,
      error: err.message,
      number: normalised,
      channel: "sms",
    };
  }
};

/**
 * Send the same message to multiple numbers.
 * Never throws — collects per-recipient results so callers can log partial failures.
 */
const sendWhatsAppBroadcast = async (recipients, payload) => {
  const list = Array.isArray(recipients)
    ? recipients.filter(Boolean)
    : [recipients].filter(Boolean);

  if (!list.length) {
    return { ok: false, error: "No recipients provided", results: [] };
  }

  const results = await Promise.all(
    list.map((number) =>
      sendWhatsAppMessage({ ...payload, number }).catch((err) => ({
        ok: false,
        error: err.message,
        number,
      })),
    ),
  );

  return {
    ok: results.every((r) => r && r.ok),
    results,
  };
};

/**
 * High-level helper used by the booking / payment controllers.
 *
 * Sends WhatsApp + SMS to the customer, and WhatsApp + SMS notification to the admin.
 */
const sendInvoiceNotifications = async (invoice, attachment, options = {}) => {
  const customerNumber =
    options.customerNumber || invoice.phone || "";
  const adminNumber = options.adminNumber || "";

  if (!adminNumber) {
    return {
      customer: { skipped: true, reason: "No admin WhatsApp number configured. Please set your phone number in Profile." },
      admin:    { skipped: true, reason: "No admin WhatsApp number configured." },
    };
  }

  const guestName = invoice.customerName || "Valued Guest";
  const total = `₹ ${(invoice.totalAmount || 0).toFixed(2)}`;
  const invoiceNo = invoice.invoiceNo || `#${invoice.bookingId || invoice.customerId || ""}`;

  const customerMessage =
    options.customerMessage ||
    `Dear ${guestName},\n\nThank you for staying at Maa Baglamukhi Resort.\n\nHere is your invoice ${invoiceNo}.\nCheck-in: ${invoice.checkIn || "—"}\nCheck-out: ${invoice.checkOut || "—"}\nTotal Amount: ${total}\n\nPlease find the invoice attached.\n\nRegards,\nMaa Baglamukhi Resort`;

  const adminMessage =
    options.adminMessage ||
    `New invoice generated for booking ${invoiceNo}.\nGuest: ${guestName}\nPhone: ${customerNumber || "N/A"}\nTotal: ${total}\nStatus: ${invoice.paymentStatus || "Pending"}`;

  // ── Send WhatsApp to customer ──────────────────────────────
  let customerWa = { skipped: true, reason: "No customer phone number" };
  if (customerNumber) {
    customerWa = await sendWhatsAppMessage({
      number: customerNumber,
      message: customerMessage,
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
    });
  }

  // ── Send SMS to customer ───────────────────────────────────
  let customerSms = { skipped: true, reason: "No customer phone number" };
  if (customerNumber) {
    customerSms = await sendSmsMessage({
      number: customerNumber,
      message: customerMessage,
    });
  }

  // ── Send WhatsApp to admin ─────────────────────────────────
  let adminWa = { skipped: true, reason: "Admin number not configured" };
  if (adminNumber) {
    adminWa = await sendWhatsAppMessage({
      number: adminNumber,
      message: adminMessage,
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
    });
  }

  // ── Send SMS to admin ──────────────────────────────────────
  let adminSms = { skipped: true, reason: "Admin number not configured" };
  if (adminNumber) {
    adminSms = await sendSmsMessage({
      number: adminNumber,
      message: adminMessage,
    });
  }

  return {
    customer: { whatsapp: customerWa, sms: customerSms },
    admin:    { whatsapp: adminWa, sms: adminSms },
  };
};

module.exports = {
  normalizePhoneNumber,
  sendWhatsAppMessage,
  sendWhatsAppBroadcast,
  sendSmsMessage,
  sendInvoiceNotifications,
};