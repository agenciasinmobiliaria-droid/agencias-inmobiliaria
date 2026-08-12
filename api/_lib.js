const crypto = require('node:crypto');
const { put, list, get } = require('@vercel/blob');

const COOKIE_NAME = 'admin_session';
const CONFIG_PATH = 'config/settings.json';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function requireMethod(req, method) {
  if (req.method !== method) return json({ error: 'Método no permitido.' }, 405, { Allow: method });
  return null;
}

function secret() {
  return process.env.ADMIN_PASSWORD || '';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('hex');
}

function makeSession() {
  const nonce = crypto.randomBytes(24).toString('hex');
  return `${nonce}.${sign(nonce)}`;
}

function validSession(req) {
  if (!secret()) return false;
  const raw = req.headers.get('cookie') || '';
  const match = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [nonce, sig] = decodeURIComponent(match[1]).split('.');
  if (!nonce || !sig) return false;
  const expected = sign(nonce);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function sessionCookie(value, maxAge = 60 * 60 * 8) {
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

async function readJsonBlob(path) {
  try {
    const result = await get(path, { access: 'private', useCache: false });
    if (!result?.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (err) {
    if (err?.status === 404 || /not found/i.test(String(err?.message))) return null;
    if (/No blob credentials found/i.test(String(err?.message))) return null;
    throw err;
  }
}

async function writeJsonBlob(path, value) {
  await put(path, JSON.stringify(value, null, 2), {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    allowOverwrite: true,
  });
}

async function readConfig() {
  const stored = await readJsonBlob(CONFIG_PATH);
  return {
    notificationEmail: stored?.notificationEmail || process.env.NOTIFICATION_EMAIL || 'agenciasinmobiliaria@gmail.com',
    phone: stored?.phone || '+1 (308) 304-1687',
    office: stored?.office || 'Cleveland, OH • United States',
    whatsapp: stored?.whatsapp || '',
    appointmentFee: 135,
  };
}

async function listSubmissions() {
  try {
    const result = await list({ prefix: 'submissions/', limit: 1000 });
    const rows = [];
    for (const blob of result.blobs || []) {
      if (!blob.pathname.endsWith('.json')) continue;
      const item = await readJsonBlob(blob.pathname);
      if (item) rows.push(item);
    }
    return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  } catch (err) {
    if (/No blob credentials found/i.test(String(err?.message))) return [];
    throw err;
  }
}

module.exports = { json, requireMethod, secret, makeSession, validSession, sessionCookie, readConfig, writeJsonBlob, listSubmissions };
