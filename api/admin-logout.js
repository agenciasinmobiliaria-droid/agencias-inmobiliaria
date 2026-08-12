const { json, requireMethod, sessionCookie } = require('./_lib');
module.exports = async function handler(req) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
};
