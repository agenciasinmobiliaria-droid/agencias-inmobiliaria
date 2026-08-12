const { json, requireMethod, validSession, listSubmissions } = require('./_lib');
module.exports = async function handler(req) {
  const methodError = requireMethod(req, 'GET');
  if (methodError) return methodError;
  if (!validSession(req)) return json({ error: 'No autorizado.' }, 401);
  try { return json({ submissions: await listSubmissions() }); }
  catch (e) { console.error(e); return json({ error: 'No se pudieron cargar las solicitudes.' }, 500); }
};
