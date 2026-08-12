const crypto = require('node:crypto');

const COOKIE_NAME = 'admin_session';

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

// Public configuration must not depend on Vercel Blob. Blob is optional storage for admin data only.
async function readConfig() {
  return {
    notificationEmail: process.env.NOTIFICATION_EMAIL || 'agenciasinmobiliaria@gmail.com',
    phone: process.env.CONTACT_PHONE || '+1 (308) 304-1687',
    office: process.env.CONTACT_OFFICE || 'Cleveland, OH • United States',
    whatsapp: process.env.CONTACT_WHATSAPP || '',
    appointmentFee: 135,
  };
}

async function writeJsonBlob(path, value) {
  const { put } = require('@vercel/blob');
  await put(path, JSON.stringify(value, null, 2), {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    allowOverwrite: true,
  });
}

async function listSubmissions() {
  try {
    const { list, get } = require('@vercel/blob');
    const result = await list({ prefix: 'submissions/', limit: 1000 });
    const rows = [];
    for (const blob of result.blobs || []) {
      if (!blob.pathname.endsWith('.json')) continue;
      try {
        const itemResult = await get(blob.pathname, { access: 'private', useCache: false });
        if (!itemResult?.stream) continue;
        const item = JSON.parse(await new Response(itemResult.stream).text());
        if (item) rows.push(item);
      } catch (err) {
        console.error('submission read error:', err);
      }
    }
    return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  } catch (err) {
    if (/No blob credentials found/i.test(String(err?.message))) return [];
    throw err;
  }
}

module.exports = { json, requireMethod, secret, makeSession, validSession, sessionCookie, readConfig, writeJsonBlob, listSubmissions };
