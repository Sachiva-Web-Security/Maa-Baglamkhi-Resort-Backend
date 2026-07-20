/**
 * WhatsApp Service — Sachiva / Wasend Integration
 *
 * Uses GET requests with query parameters as per Wasend API docs:
 *   GET https://wasend.sachiva.cloud/api/send-message
 *     ?api_key={api_key}&number={recipient}&message={text}
 *     [&file_url={url}]
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

const DEFAULT_BASE_URL =
  (process.env.wasachiva_url || process.env.WASACHIVA_URL || "https://wasend.sachiva.cloud")
    .replace(/\/+$/, "")
    .replace(/\?.*$/, ""); // strip any query params from the base URL

const API_KEY = process.env.wasachiva_key || process.env.WASACHIVA_KEY || "";

const normalizePhoneNumber = (raw) => {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
};

/**
 * GET request to Wasend gateway with query parameters.
 * Per docs: api_key, number, message, file_url (username/token only needed
 * as a fallback pair when no api_key is issued — we always use api_key here).
 */
const getFromGateway = (pathname, params = {}) => {
  const baseUrl = new URL(DEFAULT_BASE_URL);
  const url = new URL(pathname, baseUrl);

  url.searchParams.set("api_key", params.api_key || API_KEY);
  url.searchParams.set("number", params.number || "");
  if (params.message) url.searchParams.set("message", params.message);
  if (params.file_url) url.searchParams.set("file_url", params.file_url);
  if (params.type) url.searchParams.set("type", params.type);

  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;

  const options = {
    method: "GET",
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    headers: { Accept: "application/json" },
    timeout: 15000,
  };

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        const trimmed = String(data || "").trim();
        let parsed = {};
        if (trimmed) {
          try { parsed = JSON.parse(trimmed); }
          catch { parsed = { raw: trimmed }; }
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const err = new Error(`Wasend responded ${res.statusCode}: ${trimmed.slice(0, 200)}`);
          err.statusCode = res.statusCode;
          err.body = parsed;
          reject(err);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", reject);
    req.end();
  });
};

/**
 * Send a WhatsApp message via Wasend GET API.
 */
const sendWhatsAppMessage = async ({ number, message, fileUrl } = {}) => {
  const normalised = normalizePhoneNumber(number);
  if (!normalised) {
    return { ok: false, error: `Invalid phone number: ${number}`, number, channel: "whatsapp" };
  }
  if (!API_KEY) {
    return { ok: false, error: "wasachiva_key not configured", number: normalised, channel: "whatsapp" };
  }

  try {
    const response = await getFromGateway("/api/send-message", {
      api_key: API_KEY,
      number: normalised,
      message: message || "",
      file_url: fileUrl,
    });
    if (response?.status === "error") {
      const rawCode = response.code || response.statusCode || 0;
      const err = new Error(response.error || response.message || `Wasend reported an error (code: ${rawCode})`);
      err.statusCode = typeof rawCode === "number" ? rawCode : Number(rawCode) || 400;
      err.body = response;
      throw err;
    }
    return { ok: true, statusCode: 200, response, number: normalised, channel: "whatsapp" };
  } catch (err) {
    return {
      ok: false,
      statusCode: err.statusCode || 0,
      error: err.message,
      body: err.body,
      number: normalised,
      channel: "whatsapp",
    };
  }
};

/**
 * Send an SMS via Wasend GET API.
 */
const sendSmsMessage = async ({ number, message } = {}) => {
  const normalised = normalizePhoneNumber(number);
  if (!normalised) {
    return { ok: false, error: "Invalid phone number", number, channel: "sms" };
  }
  if (!API_KEY) {
    return { ok: false, error: "wasachiva_key not configured", number: normalised, channel: "sms" };
  }

  try {
    const response = await getFromGateway("/api/send-message", {
      api_key: API_KEY,
      number: normalised,
      message: message || "",
      type: "sms",
    });
    if (response?.status === "error") {
      const err = new Error(response.error || "Wasend reported an error");
      err.statusCode = response.code || 400;
      err.body = response;
      throw err;
    }
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
 * Send WhatsApp + SMS to customer and admin for an invoice.
 */
const sendInvoiceNotifications = async (invoice, attachment, options = {}) => {
  const customerNumber = options.customerNumber || invoice.phone || "";
  const adminNumber = options.adminNumber || "";
  const guestName = invoice.customerName || "Valued Guest";
  const total = `₹ ${(invoice.totalAmount || 0).toFixed(2)}`;
  const invoiceNo = invoice.invoiceNo || `#${invoice.bookingId || invoice.customerId || ""}`;

  const customerMessage =
    options.customerMessage ||
    `Dear ${guestName},\n\nThank you for staying at Maa Baglamukhi Resort.\n\nHere is your invoice ${invoiceNo}.\nCheck-in: ${invoice.checkIn || "—"}\nCheck-out: ${invoice.checkOut || "—"}\nTotal Amount: ${total}\n\nPlease find the invoice attached.\n\nRegards,\nMaa Baglamukhi Resort`;

  const adminMessage =
    options.adminMessage ||
    `New invoice generated for booking ${invoiceNo}.\nGuest: ${guestName}\nPhone: ${customerNumber || "N/A"}\nTotal: ${total}\nStatus: ${invoice.paymentStatus || "Pending"}`;

  let customerWa = { skipped: true, reason: "No customer phone number" };
  if (customerNumber) {
    customerWa = await sendWhatsAppMessage({
      number: customerNumber,
      message: customerMessage,
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
    });
  }

  let customerSms = { skipped: true, reason: "No customer phone number" };
  if (customerNumber) {
    customerSms = await sendSmsMessage({ number: customerNumber, message: customerMessage });
  }

  let adminWa = { skipped: true, reason: "Admin number not configured" };
  if (adminNumber) {
    adminWa = await sendWhatsAppMessage({
      number: adminNumber,
      message: adminMessage,
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
    });
  }

  let adminSms = { skipped: true, reason: "Admin number not configured" };
  if (adminNumber) {
    adminSms = await sendSmsMessage({ number: adminNumber, message: adminMessage });
  }

  return {
    customer: { whatsapp: customerWa, sms: customerSms },
    admin: { whatsapp: adminWa, sms: adminSms },
  };
};

module.exports = {
  normalizePhoneNumber,
  sendWhatsAppMessage,
  sendSmsMessage,
  sendInvoiceNotifications,
};