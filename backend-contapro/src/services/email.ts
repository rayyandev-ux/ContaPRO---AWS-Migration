import type { FastifyInstance } from 'fastify';
import { Resend } from 'resend';
import { config } from '../config.js';

type Locale = 'es' | 'en';

function renderTemplate(opts: { code: string; verifyUrl: string; brandName: string; brandColor: string; logoUrl?: string; locale: Locale }) {
  const { code, verifyUrl, brandName, brandColor, logoUrl, locale } = opts;
  const t = (key: string) => {
    const dict: Record<string, Record<Locale, string>> = {
      subject: { es: `Tu código de verificación - ${brandName}`, en: `Your verification code - ${brandName}` },
      heading: { es: 'Verifica tu cuenta', en: 'Verify your account' },
      intro: { es: 'Tu código de verificación es:', en: 'Your verification code is:' },
      button: { es: 'Verificar cuenta', en: 'Verify account' },
      footer: { es: 'Si no solicitaste este correo, ignóralo.', en: 'If you did not request this email, please ignore it.' },
    };
    return dict[key]?.[locale] || dict[key]?.es || key;
  };

  const text = `${t('intro')} ${code}\n\n${verifyUrl}`;
  const html = `
    <div style="font-family: Arial, sans-serif; background:#f9fafb; padding:24px;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px;">
        <div style="padding:20px 24px; display:flex; align-items:center; gap:12px; border-bottom:1px solid #e5e7eb;">
          ${logoUrl ? `<img src="${logoUrl}" alt="${brandName}" style="height:32px;">` : ''}
          <strong style="font-size:16px; color:#111827;">${brandName}</strong>
        </div>
        <div style="padding:24px;">
          <h2 style="margin:0 0 12px; color:#111827; font-size:20px;">${t('heading')}</h2>
          <p style="margin:0 0 16px; color:#374151;">${t('intro')}</p>
          <div style="font-size:28px; font-weight:700; letter-spacing:6px; color:#111827; margin-bottom:16px;">${code}</div>
          <a href="${verifyUrl}" style="display:inline-block; background:${brandColor}; color:#ffffff; text-decoration:none; padding:10px 16px; border-radius:8px;">${t('button')}</a>
          <p style="margin-top:24px; color:#6b7280; font-size:12px;">${t('footer')}</p>
        </div>
      </div>
    </div>`;

  return { subject: t('subject'), text, html };
}

function renderResetTemplate(opts: { code: string; resetUrl: string; brandName: string; brandColor: string; logoUrl?: string; locale: Locale }) {
  const { code, resetUrl, brandName, brandColor, logoUrl, locale } = opts;
  const t = (key: string) => {
    const dict: Record<string, Record<Locale, string>> = {
      subject: { es: `Restablece tu contraseña - ${brandName}`, en: `Reset your password - ${brandName}` },
      heading: { es: 'Restablece tu contraseña', en: 'Reset your password' },
      intro: { es: 'Tu código para restablecer es:', en: 'Your reset code is:' },
      button: { es: 'Continuar al restablecimiento', en: 'Continue to reset' },
      footer: { es: 'Si no solicitaste este correo, ignóralo.', en: 'If you did not request this email, please ignore it.' },
    };
    return dict[key]?.[locale] || dict[key]?.es || key;
  };

  const text = `${t('intro')} ${code}\n\n${resetUrl}`;
  const html = `
    <div style="font-family: Arial, sans-serif; background:#f9fafb; padding:24px;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px;">
        <div style="padding:20px 24px; display:flex; align-items:center; gap:12px; border-bottom:1px solid #e5e7eb;">
          ${logoUrl ? `<img src="${logoUrl}" alt="${brandName}" style="height:32px;">` : ''}
          <strong style="font-size:16px; color:#111827;">${brandName}</strong>
        </div>
        <div style="padding:24px;">
          <h2 style="margin:0 0 12px; color:#111827; font-size:20px;">${t('heading')}</h2>
          <p style="margin:0 0 16px; color:#374151;">${t('intro')}</p>
          <div style="font-size:28px; font-weight:700; letter-spacing:6px; color:#111827; margin-bottom:16px;">${code}</div>
          <a href="${resetUrl}" style="display:inline-block; background:${brandColor}; color:#ffffff; text-decoration:none; padding:10px 16px; border-radius:8px;">${t('button')}</a>
          <p style="margin-top:24px; color:#6b7280; font-size:12px;">${t('footer')}</p>
        </div>
      </div>
    </div>`;

  return { subject: t('subject'), text, html };
}

export async function sendVerificationEmail(app: FastifyInstance, to: string, code: string, options?: { locale?: Locale }) {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const from = process.env.MAIL_FROM || 'ContaPRO <no-reply@contapro.lat>';
  const frontendUrl = config.frontendUrl;
  const brandName = process.env.EMAIL_BRAND_NAME || 'ContaPRO';
  const brandColor = process.env.EMAIL_BRAND_COLOR || '#2563EB';
  const logoUrl = process.env.EMAIL_LOGO_URL || '';
  const locale: Locale = (options?.locale || (process.env.EMAIL_LOCALE as Locale) || 'es') as Locale;

  if (!resendApiKey) {
    app.log.warn({ msg: 'Resend API key missing. Email sending disabled.', to, code });
    app.log.info({
      msg: 'Verification code (fallback)',
      to,
      code,
      verifyLink: `${frontendUrl}/verify?email=${encodeURIComponent(to)}`,
    });
    return;
  }

  const verifyUrl = `${frontendUrl}/verify?email=${encodeURIComponent(to)}`;
  const { subject, text, html } = renderTemplate({ code, verifyUrl, brandName, brandColor, logoUrl: logoUrl || undefined, locale });

  try {
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({ from, to, subject, text, html });
    if (error) {
      app.log.error({ msg: 'Failed to send verification email', to, err: error });
      throw error;
    }
    app.log.info({ msg: 'Verification email sent', to, messageId: data?.id });
  } catch (err) {
    app.log.error({ msg: 'Failed to send verification email', to, err });
    throw err;
  }
}

export function generateCode(): string {
  // 6 dígitos
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendPasswordResetEmail(app: FastifyInstance, to: string, code: string, options?: { locale?: Locale }) {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const from = process.env.MAIL_FROM || 'ContaPRO <no-reply@contapro.lat>';
  const frontendUrl = config.frontendUrl;
  const brandName = process.env.EMAIL_BRAND_NAME || 'ContaPRO';
  const brandColor = process.env.EMAIL_BRAND_COLOR || '#2563EB';
  const logoUrl = process.env.EMAIL_LOGO_URL || '';
  const locale: Locale = (options?.locale || (process.env.EMAIL_LOCALE as Locale) || 'es') as Locale;

  if (!resendApiKey) {
    app.log.warn({ msg: 'Resend API key missing. Email sending disabled.', to, code });
    app.log.info({ msg: 'Password reset code (fallback)', to, code, resetUrl: `${frontendUrl}/reset?email=${encodeURIComponent(to)}` });
    return;
  }

  const resetUrl = `${frontendUrl}/reset?email=${encodeURIComponent(to)}`;
  const { subject, text, html } = renderResetTemplate({ code, resetUrl, brandName, brandColor, logoUrl: logoUrl || undefined, locale });
  try {
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({ from, to, subject, text, html });
    if (error) {
      app.log.error({ msg: 'Failed to send password reset email', to, err: error });
      throw error;
    }
    app.log.info({ msg: 'Password reset email sent', to, messageId: data?.id });
  } catch (err) {
    app.log.error({ msg: 'Failed to send password reset email', to, err });
    throw err;
  }
}

function renderReceiptTemplate(opts: { orderId: string; period: string; amount: number; currency: string; expires?: string; dashboardUrl: string; brandName: string; brandColor: string; logoUrl?: string; locale: Locale }) {
  const { orderId, period, amount, currency, expires, dashboardUrl, brandName, brandColor, logoUrl, locale } = opts;
  
  const t = (key: string) => {
    const dict: Record<string, Record<Locale, string>> = {
      subject: { es: `Confirmación de compra - ${brandName}`, en: `Purchase confirmation - ${brandName}` },
      heading: { es: 'Gracias por tu compra', en: 'Thanks for your purchase' },
      intro: { es: 'Tu pedido ha sido procesado con éxito.', en: 'Your order has been successfully processed.' },
      plan: { es: 'Producto / Plan', en: 'Product / Plan' },
      order: { es: 'ID de Pedido', en: 'Order ID' },
      amount: { es: 'Total pagado', en: 'Total paid' },
      expiresL: { es: 'Vencimiento', en: 'Expires' },
      button: { es: 'Ir a mi cuenta', en: 'Go to my account' },
      footer: { es: '© 2026 ContaPRO. Todos los derechos reservados.', en: '© 2026 ContaPRO. All rights reserved.' },
      detail: { es: 'Detalles del recibo', en: 'Receipt details' },
    };
    return dict[key]?.[locale] || dict[key]?.es || key;
  };

  const getProductLabel = () => {
    if (period === 'EXTRA_PROFILE') return locale === 'en' ? 'Extra Profile Slot' : 'Slot de Perfil Extra';
    if (period === 'EXTRA_EMAIL') return locale === 'en' ? 'Extra Email Slot' : 'Slot de Correo Extra';
    if (period === 'ANNUAL') return locale === 'en' ? 'Premium Plan (Annual)' : 'Plan Premium (Anual)';
    if (period === 'MONTHLY') return locale === 'en' ? 'Premium Plan (Monthly)' : 'Plan Premium (Mensual)';
    if (period === 'QUARTERLY') return locale === 'en' ? 'Premium Plan (Quarterly)' : 'Plan Premium (Trimestral)';
    if (period === 'LIFETIME') return locale === 'en' ? 'Premium Plan (Lifetime)' : 'Plan Premium (Vitalicio)';
    if (period === 'REACTIVATION') return locale === 'en' ? 'Subscription Reactivated' : 'Suscripción Reactivada';
    return period;
  };

  const productLabel = getProductLabel();
  const amtFormatted = `${Number(amount).toLocaleString(locale === 'en' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })} ${currency.toUpperCase()}`;
  
  const text = [
    t('intro'),
    `${t('plan')}: ${productLabel}`,
    `${t('order')}: ${orderId}`,
    `${t('amount')}: ${amtFormatted}`,
    expires ? `${t('expiresL')}: ${new Date(expires).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE')}` : ''
  ].filter(Boolean).join('\n') + `\n\n${dashboardUrl}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('subject')}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" max-width="600" style="max-width: 600px; background-color: #0b0b0b; border: 1px solid #1f2937; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; border-bottom: 1px solid #1f2937;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      ${logoUrl ? `<img src="${logoUrl}" alt="${brandName}" height="32" style="height: 32px; vertical-align: middle;">` : ''}
                      <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin-left: 8px;">${brandName}</span>
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-size: 10px; font-weight: 900; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.2em;">${t('detail')}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 16px; color: #ffffff; font-size: 32px; font-weight: 700; font-family: 'Playfair Display', serif, Georgia, serif; font-style: italic;">${t('heading')}</h1>
              <p style="margin: 0 0 40px; color: rgba(255,255,255,0.5); font-size: 16px; line-height: 1.6;">${t('intro')}</p>

              <!-- Glass Card Mock -->
              <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 32px; margin-bottom: 40px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding-bottom: 24px;">
                      <div style="font-size: 10px; font-weight: 900; color: rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">${t('plan')}</div>
                      <div style="font-size: 18px; font-weight: 700; color: #ffffff;">${productLabel}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 24px;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="50%">
                            <div style="font-size: 10px; font-weight: 900; color: rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">${t('order')}</div>
                            <div style="font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.8);">${orderId}</div>
                          </td>
                          <td width="50%">
                            <div style="font-size: 10px; font-weight: 900; color: rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">${t('amount')}</div>
                            <div style="font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.8);">${amtFormatted}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${expires ? `
                  <tr>
                    <td>
                      <div style="font-size: 10px; font-weight: 900; color: rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">${t('expiresL')}</div>
                      <div style="font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.8);">${new Date(expires).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </td>
                  </tr>` : ''}
                </table>
              </div>

              <a href="${dashboardUrl}" style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; padding: 16px 32px; border-radius: 100px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 10px 20px rgba(255,255,255,0.1); transition: all 0.3s ease;">${t('button')}</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <p style="margin: 0; color: rgba(255,255,255,0.2); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">${t('footer')}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: t('subject'), text, html };
}

export async function sendPurchaseReceiptEmail(app: FastifyInstance, to: string, data: { orderId: string; period: string; amount: number; currency: string; expires?: Date | string; locale?: Locale }) {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const from = process.env.MAIL_FROM || 'ContaPRO <no-reply@contapro.lat>';
  const frontendUrl = config.frontendUrl;
  const brandName = process.env.EMAIL_BRAND_NAME || 'ContaPRO';
  const brandColor = process.env.EMAIL_BRAND_COLOR || '#2563EB';
  const logoUrl = process.env.EMAIL_LOGO_URL || '';
  const locale: Locale = (data?.locale || (process.env.EMAIL_LOCALE as Locale) || 'es') as Locale;
  const dashboardUrl = `${frontendUrl}/dashboard`;
  
  let expiresIso: string | undefined = undefined;
  if (data.expires) {
      if (typeof data.expires === 'string') {
          expiresIso = data.expires;
      } else {
          // Es un objeto Date, comprobar si es válido
          if (!isNaN(data.expires.getTime())) {
              expiresIso = data.expires.toISOString();
          } else {
              app.log.warn({ to, orderId: data.orderId }, 'Invalid Date object passed to sendPurchaseReceiptEmail for expires field');
          }
      }
  }
  
  const { subject, text, html } = renderReceiptTemplate({ 
    orderId: data.orderId, 
    period: data.period, 
    amount: data.amount, 
    currency: data.currency, 
    expires: expiresIso, 
    dashboardUrl, 
    brandName, 
    brandColor, 
    logoUrl: logoUrl || undefined, 
    locale 
  });

  const tryResend = async () => {
    const resend = new Resend(resendApiKey);
    app.log.info({ msg: 'email:purchase:sending', provider: 'resend', to, orderId: data.orderId });
    const { data: result, error } = await resend.emails.send({ from, to, subject, text, html });
    if (error) throw error;
    app.log.info({ msg: 'email:purchase:sent', provider: 'resend', to, messageId: result?.id, orderId: data.orderId });
  };

  const trySmtp = async () => {
    const host = process.env.SMTP_HOST || '';
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
    if (!host || !user || !pass) {
      app.log.warn({ msg: 'smtp:missing_config', host, userPresent: !!user, passPresent: !!pass });
      throw new Error('SMTP not configured');
    }
    const nm: any = await import('nodemailer');
    const transporter = (nm.default || nm).createTransport({ host, port, secure, auth: { user, pass } });
    app.log.info({ msg: 'email:purchase:sending', provider: 'smtp', to, orderId: data.orderId });
    const info = await transporter.sendMail({ from, to, subject, text, html });
    app.log.info({ msg: 'email:purchase:sent', provider: 'smtp', to, messageId: info?.messageId, orderId: data.orderId });
  };

  try {
    if (resendApiKey) {
      try {
        await tryResend();
        return;
      } catch (e) {
        app.log.error({ msg: 'email:purchase:resend_failed', to, orderId: data.orderId, err: e as any });
      }
    }
    await trySmtp();
  } catch (err) {
    app.log.error({ msg: 'email:purchase:failed', to, orderId: data.orderId, err });
    // Fallback log with details for manual follow-up
    app.log.info({ msg: 'Purchase receipt (fallback)', to, orderId: data.orderId, period: data.period, amount: data.amount, currency: data.currency, expires: expiresIso, dashboardUrl });
  }
}
