const { json, requireMethod, validSession, readConfig, writeJsonBlob } = require('./_lib');

module.exports = async function handler(req) {
  if (req.method === 'GET') {
    const c = await readConfig();
    return json({ phone: c.phone, office: c.office, whatsapp: c.whatsapp, appointmentFee: 135 });
  }
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;
  if (!validSession(req)) return json({ error: 'No autorizado.' }, 401);
  try {
    const body = await req.json();
    const current = await readConfig();
    const next = {
      notificationEmail: String(body.notificationEmail || current.notificationEmail).trim().slice(0,254),
      phone: String(body.phone || current.phone).trim().slice(0,60),
      office: String(body.office || current.office).trim().slice(0,200),
      whatsapp: String(body.whatsapp || current.whatsapp).replace(/\D/g,'').slice(0,20),
      appointmentFee: 135,
    };
    await writeJsonBlob('config/settings.json', next);
    return json(next);
  } catch (e) { console.error(e); return json({ error: 'No se pudo guardar la configuración.' }, 500); }
};
