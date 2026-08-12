const crypto = require('node:crypto');
const { json, requireMethod, secret, makeSession, sessionCookie } = require('./_lib');

module.exports = async function handler(req) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;
  if (!secret()) return json({ error: 'El acceso administrativo no está configurado.' }, 503);
  try {
    const { password } = await req.json();
    const supplied = Buffer.from(String(password || ''));
    const expected = Buffer.from(secret());
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return json({ error: 'Contraseña incorrecta.' }, 401);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(makeSession()) });
  } catch (e) { return json({ error: 'Solicitud inválida.' }, 400); }
};
