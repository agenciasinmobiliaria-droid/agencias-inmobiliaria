# Solicitud de Alquiler — Vercel

Incluye formulario público y panel privado en `/admin`.

## Funciones
- Recibe solicitudes en `/api/submit`.
- Guarda las solicitudes en Vercel Blob privado.
- Envía una notificación por correo mediante Resend.
- Panel `/admin` para ver solicitudes y cambiar teléfono, oficina, WhatsApp, correo de notificaciones y tarifa.
- Sesión administrativa protegida con cookie HttpOnly.

## Variables necesarias en Vercel
- `ADMIN_PASSWORD` — contraseña del panel `/admin`.
- `RESEND_API_KEY` — API key de Resend.
- `FROM_EMAIL` — remitente verificado en Resend.
- `NOTIFICATION_EMAIL` — correo inicial de notificaciones (por defecto agenciasinmobiliaria@gmail.com).
- `BLOB_READ_WRITE_TOKEN` — token de Vercel Blob. En una nueva conexión de Blob, Vercel también soporta autenticación OIDC; si el proyecto queda conectado a un Blob con OIDC, usa la configuración recomendada por Vercel.

## Enlaces
- Sitio público: `/`
- Panel: `/admin`

## Importante
El panel muestra información personal enviada por los solicitantes. Mantén `/admin` protegido y usa una contraseña fuerte. La tarifa de $135 sigue siendo informativa; no se procesan pagos en esta versión.
