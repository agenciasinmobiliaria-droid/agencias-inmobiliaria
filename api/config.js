const { validSession, readConfig, writeJsonBlob } = require('./_lib');

function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding?.('utf8');
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const c = await readConfig();
    return sendJson(res, { phone: c.phone, office: c.office, whatsapp: c.whatsapp, appointmentFee: 135 });
  }

  if (req.method !== 'POST') return sendJson(res, { error: 'Método no permitido.' }, 405);
  if (!validSession(req)) return sendJson(res, { error: 'No autorizado.' }, 401);

  try {
    const body = await readRequestBody(req);
    const current = await readConfig();
    const next = {
      notificationEmail: String(body.notificationEmail || current.notificationEmail).trim().slice(0, 254),
      phone: String(body.phone || current.phone).trim().slice(0, 60),
      office: String(body.office || current.office).trim().slice(0, 200),
      whatsapp: String(body.whatsapp || current.whatsapp).replace(/\D/g, '').slice(0, 20),
      appointmentFee: 135,
    };

    // Blob remains optional for admin configuration. Public requests do not depend on it.
    try {
      await writeJsonBlob('config/settings.json', next);
    } catch (storageError) {
      console.warn('Optional Blob config storage unavailable:', storageError?.message || storageError);
    }

    return sendJson(res, next);
  } catch (e) {
    console.error(e);
    return sendJson(res, { error: 'No se pudo guardar la configuración.' }, 500);
  }
};
