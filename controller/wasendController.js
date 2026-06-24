const { getSettings } = require("../utils/whatsappNotify");
const { HttpError } = require("../middleware/errorHandler");

const BASE_URL = "https://wasend.sachiva.cloud";

const safeFetch =
  global.fetch ||
  (async (...args) => {
    const undici = require("undici");
    return undici.fetch(...args);
  });

async function resolveCredentials() {
  const settings = await getSettings();
  const username =
    (settings?.wasend_username && String(settings.wasend_username).trim()) ||
    process.env.WASEND_USERNAME;
  const token =
    (settings?.wasend_token && String(settings.wasend_token).trim()) ||
    process.env.WASEND_TOKEN;
  if (!username || !token) {
    throw new HttpError(503, "WASend credentials are not configured", "WASEND_NO_CREDENTIALS");
  }
  return { username, token };
}

async function forwardToWASend(pathname, params, init = {}) {
  const { username, token } = await resolveCredentials();
  const url = new URL(`${BASE_URL}${pathname}`);
  url.searchParams.set("username", username);
  url.searchParams.set("token", token);
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null) url.searchParams.set(k, String(v));
  }

  const response = await safeFetch(url.toString(), init);
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = { status: "error", error: "Invalid JSON from WASend" };
  }
  return { status: response.status, data };
}

const sendMessage = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { number, message, file_url, file_name } = body;
    if (!number || !message) {
      throw new HttpError(400, "number and message are required");
    }
    const { status, data } = await forwardToWASend(
      "/api/send-message",
      {
        number: String(number).replace(/[^0-9]/g, ""),
        message,
        file_url,
        file_name,
      },
    );
    return res.status(status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    return next(err);
  }
};

const getBalance = async (req, res, next) => {
  try {
    const { status, data } = await forwardToWASend("/api/balance", {});
    return res.status(status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    return next(err);
  }
};

const getReports = async (req, res, next) => {
  try {
    const { status, data } = await forwardToWASend("/api/reports", {});
    return res.status(status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    return next(err);
  }
};

const listContacts = async (req, res, next) => {
  try {
    const { status, data } = await forwardToWASend("/api/contacts", {});
    return res.status(status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    return next(err);
  }
};

const createContact = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { status, data } = await forwardToWASend(
      "/api/contacts",
      {},
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return res.status(status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    return next(err);
  }
};

// importContacts previously forwarded the entire body (including the
// caller's username/token). That endpoint is intentionally not exposed
// here — admins configure their contact lists through the UI, not via
// ad-hoc import calls.
const importContacts = async (_req, res) =>
  res.status(410).json({ message: "Contact import has been disabled" });

const listCampaigns = async (req, res, next) => {
  try {
    const { status, data } = await forwardToWASend("/api/campaign", {});
    return res.status(status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    return next(err);
  }
};

const createCampaign = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { status, data } = await forwardToWASend(
      "/api/campaign",
      {},
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return res.status(status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  sendMessage,
  getBalance,
  getReports,
  listContacts,
  createContact,
  importContacts,
  listCampaigns,
  createCampaign,
};
