
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { decrypt } from '../utils/crypto.js';

const prisma = new PrismaClient();
const userId = 'f29a0d33-92a1-4433-ac9e-896b1b44b106';

async function main() {
  const integration = await prisma.emailIntegration.findFirst({
    where: { userId, provider: 'GMAIL', isActive: true }
  });

  if (!integration) {
    console.log('No integration found');
    return;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: decrypt(integration.accessToken),
    refresh_token: decrypt(integration.refreshToken)
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Replicate the EXACT logic from emailScanner.ts
  const settings = integration.settings as { allowedSenders?: string[] } | null;
  const defaultSenders = ['yape', 'plin', 'uber', 'rappi', 'didifood', 'bcp', 'bbva', 'interbank', 'scotiabank'];
  const allowedSenders = Array.isArray(settings?.allowedSenders) ? settings!.allowedSenders : defaultSenders;

  console.log('Allowed Senders:', allowedSenders);

  const queryParts = allowedSenders.map(s => {
      if (s.includes('@') || s.includes('.')) return `from:${s}`;
      return `(from:${s} OR subject:${s})`;
  });
  const filterQuery = queryParts.join(' OR ');
  
  // Test with 3d to be safe like the manual test endpoint
  const timeQuery = 'newer_than:3d'; 
  const q = `label:inbox ${timeQuery} (${filterQuery})`;

  console.log('---------------------------------------------------');
  console.log('Generated Query:', q);
  console.log('---------------------------------------------------');

  try {
    const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 10 });
    const messages = res.data.messages || [];
    
    console.log(`Found ${messages.length} messages.`);
    
    for (const msg of messages) {
        const full = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
        const headers = full.data.payload?.headers;
        const subject = headers?.find(h => h.name === 'Subject')?.value;
        const from = headers?.find(h => h.name === 'From')?.value;
        const date = headers?.find(h => h.name === 'Date')?.value;
        console.log(`[${msg.id}] Date: ${date} | From: ${from} | Subject: ${subject}`);
    }

  } catch (e: any) {
    console.error('Error querying Gmail:', e.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
