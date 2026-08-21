import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/* ────────────────────────────────────────────────────────────────
   Correo saliente (SMTP). Variables en .env:
     MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD,
     MAIL_ENCRYPTION (tls|ssl), MAIL_FROM_ADDRESS, MAIL_FROM_NAME
   Sin MAIL_HOST o MAIL_PASSWORD el envío se omite (isMailConfigured=false)
   y las acciones siguen funcionando: el admin ve la contraseña en pantalla.
   ──────────────────────────────────────────────────────────────── */

const FROM_NAME_DEFAULT = "Escuela de Posgrado de Ingeniería · UNAMAD";

export function isMailConfigured(): boolean {
  return Boolean(process.env.MAIL_HOST && process.env.MAIL_USERNAME && process.env.MAIL_PASSWORD);
}

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.MAIL_PORT ?? 587);
  const enc = (process.env.MAIL_ENCRYPTION ?? "tls").toLowerCase();
  cached = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    secure: enc === "ssl" || port === 465, // 465 = SMTPS; 587 = STARTTLS
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });
  return cached;
}

function fromHeader(): string {
  const name = process.env.MAIL_FROM_NAME ?? FROM_NAME_DEFAULT;
  const addr = process.env.MAIL_FROM_ADDRESS ?? process.env.MAIL_USERNAME ?? "";
  return `"${name.replace(/"/g, "")}" <${addr}>`;
}

/** URL pública de la app para los enlaces del correo. */
export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  return `${base}${path}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SendResult = { sent: true } | { sent: false; reason: string };

/** Envía un correo. Nunca lanza: devuelve {sent:false, reason} si falla. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!isMailConfigured()) {
    return { sent: false, reason: "Correo no configurado (MAIL_* en .env)." };
  }
  try {
    await transporter().sendMail({ from: fromHeader(), ...opts });
    return { sent: true };
  } catch (e) {
    console.error("sendMail:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { sent: false, reason: msg };
  }
}

/* ─────────────────────────── Plantillas ─────────────────────────── */

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f3f4;font-family:Roboto,Helvetica,Arial,sans-serif;color:#202124;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f3f4;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dadce0;border-radius:14px;overflow:hidden;">
  <tr><td style="background:#1a73e8;padding:18px 28px;color:#fff;">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">UNAMAD</div>
    <div style="font-size:17px;font-weight:700;margin-top:2px;">Escuela de Posgrado de Ingeniería</div>
  </td></tr>
  <tr><td style="padding:28px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
  <tr><td style="padding:16px 28px;border-top:1px solid #dadce0;font-size:12px;color:#5f6368;line-height:1.5;">
    Este es un mensaje automático de la Universidad Nacional Amazónica de Madre de Dios.
    Si no esperabas este correo, ignóralo o escribe a
    <a href="mailto:posgrado.ingenieria@unamad.edu.pe" style="color:#1a73e8;">posgrado.ingenieria@unamad.edu.pe</a>.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/**
 * Credenciales de acceso al matricular. Si `password` es null, el correo
 * solo confirma la matrícula (la cuenta ya existía y conserva su clave).
 */
export async function sendEnrollmentEmail(opts: {
  to: string;
  name: string;
  diplomaTitle: string;
  password: string | null;
}): Promise<SendResult> {
  const loginUrl = appUrl("/login");
  const first = opts.name.split(/\s+/)[0] ?? opts.name;
  const subject = opts.password
    ? `Tus credenciales de acceso · Diplomado en ${opts.diplomaTitle}`
    : `Matrícula confirmada · Diplomado en ${opts.diplomaTitle}`;

  const credsHtml = opts.password
    ? `<p>Estas son tus credenciales para ingresar al <b>portal académico</b>:</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:10px 0 18px;border:1px dashed #1a73e8;border-radius:10px;background:#f0f6ff;">
  <tr><td style="padding:14px 18px;font-size:14px;line-height:1.9;">
    <div><span style="color:#5f6368;">Usuario:</span> <b>${esc(opts.to)}</b></div>
    <div><span style="color:#5f6368;">Contraseña temporal:</span>
      <b style="font-family:Consolas,Menlo,monospace;font-size:16px;letter-spacing:1px;">${esc(opts.password)}</b></div>
  </td></tr>
</table>
<p style="font-size:13.5px;color:#5f6368;">Por seguridad, cambia tu contraseña en cuanto ingreses (menú <b>Mi cuenta</b>).</p>`
    : `<p>Ingresa al <b>portal académico</b> con tu cuenta institucional <b>${esc(opts.to)}</b> y la contraseña que ya usas.</p>`;

  const html = layout(
    subject,
    `<p style="margin-top:0;">Hola, <b>${esc(first)}</b>:</p>
<p>¡Bienvenido(a)! Has sido matriculado(a) en el <b>Diplomado en ${esc(opts.diplomaTitle)}</b> de la Escuela de Posgrado de Ingeniería de la UNAMAD.</p>
${credsHtml}
<p style="margin:22px 0;">
  <a href="${loginUrl}" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;">Ingresar al portal académico</a>
</p>
<p style="font-size:13px;color:#5f6368;">Si el botón no funciona, copia este enlace en tu navegador:<br>
<a href="${loginUrl}" style="color:#1a73e8;">${loginUrl}</a></p>
<p>En el aula encontrarás tus módulos, materiales, asistencia y notas.</p>`,
  );

  const text = [
    `Hola, ${first}:`,
    ``,
    `Has sido matriculado(a) en el Diplomado en ${opts.diplomaTitle} (Escuela de Posgrado de Ingeniería, UNAMAD).`,
    ``,
    ...(opts.password
      ? [
          `Credenciales del portal académico:`,
          `  Usuario: ${opts.to}`,
          `  Contraseña temporal: ${opts.password}`,
          ``,
          `Cambia tu contraseña en cuanto ingreses (Mi cuenta).`,
        ]
      : [`Ingresa con tu cuenta ${opts.to} y la contraseña que ya usas.`]),
    ``,
    `Portal académico: ${loginUrl}`,
  ].join("\n");

  return sendMail({ to: opts.to, subject, html, text });
}
