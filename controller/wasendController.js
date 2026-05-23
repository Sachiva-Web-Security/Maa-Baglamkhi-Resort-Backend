const BASE_URL = 'https://wasend.sachiva.cloud';

const safeFetch = global.fetch || (async (...args) => {
  // Fallback to node's undici if available
  const undici = require('undici');
  return undici.fetch(...args);
});

const sendMessage = async (req, res, next) => {
  try {
    const src = { ...(req.query || {}), ...(req.body || {}) };
    const { username, token, number, message, file_url, file_name } = src;
    const u = username || process.env.WASEND_USERNAME;
    const t = token || process.env.WASEND_TOKEN;
    if (!u || !t || !number || !message) {
      return res.status(400).json({ status: 'error', error: 'username, token, number and message are required' });
    }

    const url = new URL(`${BASE_URL}/api/send-message`);
    url.searchParams.set('username', u);
    url.searchParams.set('token', t);
    url.searchParams.set('number', String(number).replace(/[^0-9]/g, ''));
    url.searchParams.set('message', message);
    if (file_url) url.searchParams.set('file_url', file_url);
    if (file_name) url.searchParams.set('file_name', file_name);

    const response = await safeFetch(url.toString());
    const data = await response.json().catch(() => ({ status: 'error', error: 'Invalid JSON from WASend' }));
    return res.status(response.status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    next(err);
  }
};

const getBalance = async (req, res, next) => {
  try {
    const { username, token } = req.query || {};
    const u = username || process.env.WASEND_USERNAME;
    const t = token || process.env.WASEND_TOKEN;
    if (!u || !t) return res.status(400).json({ status: 'error', error: 'username and token are required' });

    const url = new URL(`${BASE_URL}/api/balance`);
    url.searchParams.set('username', u);
    url.searchParams.set('token', t);

    const response = await safeFetch(url.toString());
    const data = await response.json().catch(() => ({ status: 'error', error: 'Invalid JSON from WASend' }));
    return res.status(response.status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    next(err);
  }
};

const getReports = async (req, res, next) => {
  try {
    const { username, token } = req.query || {};
    const u = username || process.env.WASEND_USERNAME;
    const t = token || process.env.WASEND_TOKEN;
    if (!u || !t) return res.status(400).json({ status: 'error', error: 'username and token are required' });

    const url = new URL(`${BASE_URL}/api/reports`);
    url.searchParams.set('username', u);
    url.searchParams.set('token', t);

    const response = await safeFetch(url.toString());
    const data = await response.json().catch(() => ({ status: 'error', error: 'Invalid JSON from WASend' }));
    return res.status(response.status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    next(err);
  }
};

const listContacts = async (req, res, next) => {
  try {
    const { username, token } = req.query || {};
    const u = username || process.env.WASEND_USERNAME;
    const t = token || process.env.WASEND_TOKEN;
    if (!u || !t) return res.status(400).json({ status: 'error', error: 'username and token are required' });

    const url = new URL(`${BASE_URL}/api/contacts`);
    url.searchParams.set('username', u);
    url.searchParams.set('token', t);

    const response = await safeFetch(url.toString());
    const data = await response.json().catch(() => ({ status: 'error', error: 'Invalid JSON from WASend' }));
    return res.status(response.status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    next(err);
  }
};

const createContact = async (req, res, next) => {
  try {
    const body = req.body || {};
    const u = body.username || process.env.WASEND_USERNAME;
    const t = body.token || process.env.WASEND_TOKEN;
    if (!u || !t) return res.status(400).json({ status: 'error', error: 'username and token are required' });

    const payload = { ...body, username: u, token: t };
    const response = await safeFetch(`${BASE_URL}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({ status: 'error', error: 'Invalid JSON from WASend' }));
    return res.status(response.status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    next(err);
  }
};

const importContacts = async (req, res, next) => {
  try {
    const body = req.body || {};
    const u = body.username || process.env.WASEND_USERNAME;
    const t = body.token || process.env.WASEND_TOKEN;
    if (!u || !t) return res.status(400).json({ status: 'error', error: 'username and token are required' });

    const payload = { ...body, username: u, token: t };
    const response = await safeFetch(`${BASE_URL}/api/contacts/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({ status: 'error', error: 'Invalid JSON from WASend' }));
    return res.status(response.status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    next(err);
  }
};

const listCampaigns = async (req, res, next) => {
  try {
    const { username, token } = req.query || {};
    const u = username || process.env.WASEND_USERNAME;
    const t = token || process.env.WASEND_TOKEN;
    if (!u || !t) return res.status(400).json({ status: 'error', error: 'username and token are required' });

    const url = new URL(`${BASE_URL}/api/campaign`);
    url.searchParams.set('username', u);
    url.searchParams.set('token', t);

    const response = await safeFetch(url.toString());
    const data = await response.json().catch(() => ({ status: 'error', error: 'Invalid JSON from WASend' }));
    return res.status(response.status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    next(err);
  }
};

const createCampaign = async (req, res, next) => {
  try {
    const body = req.body || {};
    const u = body.username || process.env.WASEND_USERNAME;
    const t = body.token || process.env.WASEND_TOKEN;
    if (!u || !t) return res.status(400).json({ status: 'error', error: 'username and token are required' });

    const payload = { ...body, username: u, token: t };
    const response = await safeFetch(`${BASE_URL}/api/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({ status: 'error', error: 'Invalid JSON from WASend' }));
    return res.status(response.status >= 400 ? 502 : 200).json(data);
  } catch (err) {
    next(err);
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
