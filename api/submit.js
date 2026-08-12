const { readConfig } = require('./_lib');

function clean(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function sendJson(res, data, status = 200, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end(JSON.stringify(data));
}

async function readRequestBody(req) {
  // Vercel Node.js functions use IncomingMessage. Read the raw request body directly.
  if (req.body && typeof req.body === 'object') return req.body;

  return await new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding?.('utf8');
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 200000) reject(new Error('Request body too large.'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

async function sendNotification(submission, email) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !email) return false;

  const subject = `Nueva solicitud de cita — ${submission.nombre} ${submission.apellido}`;
  const text = [
    subject,
    `Fecha: ${submission.fecha} ${submission.hora}`,
    `Visita: ${submission.visita}`,
    `Teléfono: ${submission.telefono}`,
    `Email: ${submission.email}`,
    `Método de pago preferido: ${submission.metodo_pago}`,
    `Tarifa indicada: $135.00 USD`,
    `El método de pago es solo una preferencia; no se procesó ningún pago ni se solicitaron datos bancarios.`,
    '',
    `ID de solicitud: ${submission.id}`,
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Resend's onboarding sender works for the account owner's test recipient.
        // A verified FROM_EMAIL can be supplied in Vercel later without changing code.
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to: [email],
        subject,
        text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Notification provider rejected the request (${response.status}): ${detail.slice(0, 300)}`);
    }
    return true;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, { error: 'Método no permitido.' }, 405, { Allow: 'POST' });
  }

  try {
    const body = await readRequestBody(req);

    // Honeypot anti-spam.
    if (clean(body.website, 100)) return sendJson(res, { ok: true }, 200);

    const required = ['nombre', 'apellido', 'telefono', 'email', 'fecha', 'hora', 'visita', 'pago100', 'metodo_pago'];
    for (const key of required) {
      if (!clean(body[key], 300)) return sendJson(res, { error: `Falta el campo: ${key}.` }, 400);
    }

    if (body.terminos !== 'on' && body.terminos !== true && body.terminos !== 'true') {
      return sendJson(res, { error: 'Debes aceptar los términos y la política de privacidad.' }, 400);
    }

    const allowedMethods = [
      'Zelle',
      'Cash App',
      'PayPal',
      'Tarjeta de crédito/débito',
      'Transferencia bancaria',
      'Otro método autorizado',
    ];

    if (!allowedMethods.includes(clean(body.metodo_pago, 100))) {
      return sendJson(res, { error: 'Método de pago no válido.' }, 400);
    }
    if (!['Presencial', 'Virtual'].includes(clean(body.visita, 50))) {
      return sendJson(res, { error: 'Tipo de visita no válido.' }, 400);
    }
    if (!['Sí', 'No'].includes(clean(body.pago100, 20))) {
      return sendJson(res, { error: 'Respuesta de tarifa no válida.' }, 400);
    }
    if (!/^\S+@\S+\.\S+$/.test(clean(body.email, 254))) {
      return sendJson(res, { error: 'Correo electrónico no válido.' }, 400);
    }
    if (clean(body.comentarios, 5000).match(/<\s*script/i)) {
      return sendJson(res, { error: 'Contenido no válido.' }, 400);
    }

    const config = await readConfig();
    const now = new Date().toISOString();
    const id = `${Date.now()}-${cryptoRandom()}`;

    const submission = {
      id,
      createdAt: now,
      nombre: clean(body.nombre, 100),
      apellido: clean(body.apellido, 100),
      telefono: clean(body.telefono, 50),
      email: clean(body.email, 254).toLowerCase(),
      fecha: clean(body.fecha, 20),
      hora: clean(body.hora, 50),
      visita: clean(body.visita, 50),
      ciudadano: clean(body.ciudadano, 20),
      personas: clean(body.personas, 20),
      duracion: clean(body.duracion, 100),
      mudanza: clean(body.mudanza, 20),
      fuma: clean(body.fuma, 20),
      empleado: clean(body.empleado, 20),
      empresa: clean(body.empresa, 150),
      ingreso: clean(body.ingreso, 50),
      disponible: clean(body.disponible, 50),
      mascotas: clean(body.mascotas, 20),
      comentarios: clean(body.comentarios, 5000),
      appointmentFee: 135,
      pago100: clean(body.pago100, 20),
      metodo_pago: clean(body.metodo_pago, 100),
      terminosAceptados: true,
    };

    // Email is now the primary delivery mechanism. The public submission path no
    // longer waits on optional Vercel Blob storage, which caused 300-second timeouts.
    let notified = false;
    try {
      notified = await sendNotification(submission, config.notificationEmail);
    } catch (notificationError) {
      console.error('notification error:', notificationError);
    }

    if (!notified) {
      return sendJson(
        res,
        { error: 'No se pudo enviar la solicitud por correo. Verifica la configuración de Resend.' },
        503,
      );
    }

    return sendJson(res, {
      ok: true,
      deliveredTo: 'email',
      message: 'Solicitud enviada correctamente.',
    });
  } catch (error) {
    console.error('submit error:', error);
    return sendJson(
      res,
      {
        error:
          error.message === 'Invalid JSON body.'
            ? 'La solicitud no tiene un formato válido.'
            : 'No se pudo enviar la solicitud. Inténtalo de nuevo.',
      },
      500,
    );
  }
};

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10);
}
