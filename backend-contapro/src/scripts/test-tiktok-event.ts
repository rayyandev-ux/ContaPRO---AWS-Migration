
import crypto from 'node:crypto';
import { config } from '../config.js';

async function main() {
  const pixelId = 'D5FVAGRC77U4NSOIFJ7G';
  const accessToken = 'c8eda47f2e0221f8f0d8dfb42996c0186aa35162';

  console.log('Testing Direct Fetch to TikTok API...');

  const emailHash = crypto.createHash('sha256').update('test@example.com').digest('hex');

  const payload = {
    event_source_id: pixelId,
    event_source: 'web',
    data: [
      {
        event: 'StartTrial',
        event_time: Math.floor(Date.now() / 1000),
        event_id: 'TEST-' + Date.now(),
        user: {
          email: emailHash,
          ip: '127.0.0.1',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        context: {
          page: {
            url: 'https://contapro.lat/pricing'
          }
        }
      }
    ]
  };

  try {
    const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Fetch Error:', error);
  }
}

main();
