const { put } = require('@vercel/blob');
const { json, requireMethod, readConfig } = require('./_lib');

function clean(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

module.exports = async function handler(req) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  try {
    const body = await req.json();
    if (clean(body.website, 100)) return json({ ok: true }, 200);

    const required = ['nombre','apellido','telefono','email','fecha','hora','visita','pago100','metodo_pago'];
    for (const key of required) {
      if (!clean(body[key], 300)) return json({ error: `Falta el campo: ${key}.` }, 400);
    }
    if (body.terminos !== 'on' && body.terminos !== true && body.terminos !== 'true') {
      return json({ error: 'Debes aceptar los términos y la política de privacidad.' }, 400);
    }

    const allowedMethods = ['Zelle','Cash App','PayPal','Tarjeta de crédito/débito','Transferencia bancaria','Otro método autorizado'];
    if (!allowedMethods.includes(clean(body.metodo_pago, 100))) return json({ error: 'Método de pago no válido.' }, 400);
    if (!['Presencial','Virtual'].includes(clean(body.visita, 50))) return json({ error: 'Tipo de visita no válido.' }, 400);
    if (!['Sí','No'].includes(clean(body.pago100, 20))) return json({ error: 'Respuesta de tarifa no válida.' }, 400);
    if (!/^\S+@\S+\.\S+$/.test(clean(body.email, 254))) return json({ error: 'Correo electrónico no válido.' }, 400);
    if (clean(body.comentarios, 5000).match(/<\s*script/i)) return json({ error: 'Contenido no válido.' }, 400);

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

    await put(`submissions/${id}.json`, JSON.stringify(submission), {
      access: 'private',
      contentType: 'application/json; charset=utf-8',
      addRandomSuffix: false,
    });

    if (process.env.RESEND_API_KEY && config.notificationEmail && process.env.FROM_EMAIL) {
      const safeSubject = `Nueva solicitud de cita — ${submission.nombre} ${submission.apellido}`;
      const text = [
        safeSubject,
        `Fecha: ${submission.fecha} ${submission.hora}`,
        `Visita: ${submission.visita}`,
        `Teléfono: ${submission.telefono}`,
        `Email: ${submission.email}`,
        `Método de pago preferido: ${submission.metodo_pago}`,
        `Tarifa indicada: $135.00 USD`,
        `El método de pago es solo una preferencia; no se procesó ningún pago ni se solicitaron datos bancarios.`,
      ].join('\n');
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: process.env.FROM_EMAIL, to: [config.notificationEmail], subject: safeSubject, text }),
        });
      } catch (mailError) {
        console.error('Notification email failed after storing submission:', mailError);
      }
    }

    return json({ ok: true });
  } catch (error) {
    console.error('submit error:', error);
    return json({ error: 'No se pudo guardar la solicitud. Inténtalo de nuevo.' }, 500);
  }
};

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10);
}
