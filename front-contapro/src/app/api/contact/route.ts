import { NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subject, name, whatsapp, email, message, countryCode } = body;

    // Validate required fields
    if (!subject || !name || !whatsapp || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Telegram credentials missing');
      // Still return success to user but log error server-side? 
      // No, better to fail so they know something is wrong, or fail silently if we don't want to expose it.
      // For this task, "haz que funcione", I should probably warn if env is missing.
      return NextResponse.json(
        { error: 'Server configuration error (Telegram)' },
        { status: 500 }
      );
    }

    const text = `
📩 *Nuevo Mensaje de Contacto*

*Asunto:* ${subject}
*Nombre:* ${name}
*WhatsApp:* ${countryCode} ${whatsapp}
*Email:* ${email}

*Mensaje:*
${message}
    `;

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text,
          parse_mode: 'Markdown',
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram API error:', data);
      throw new Error(data.description || 'Failed to send telegram message');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
