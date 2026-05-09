import crypto from 'node:crypto';
import { config } from '../config.js';

interface TikTokEventData {
  eventName: string;
  eventId?: string; // Unique ID for deduplication
  eventTime?: number; // Unix timestamp
  eventSourceUrl?: string;
  user: {
    email?: string;
    phone?: string;
    ip?: string;
    userAgent?: string;
    externalId?: string;
    ttclid?: string;
    ttp?: string;
  };
  properties?: Record<string, any>; // value, currency, content_id, etc.
}

export class TikTokService {
  private static API_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

  private static hash(value: string): string {
    return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
  }

  static async sendEvent(data: TikTokEventData) {
    if (!config.tiktokAccessToken || !config.tiktokPixelId) {
      console.warn('TikTok Access Token or Pixel ID not configured. Skipping event.');
      return;
    }

    const payload = {
      event_source_id: config.tiktokPixelId.trim(),
      event_source: 'web',
      data: [
        {
          event: data.eventName,
          event_time: data.eventTime || Math.floor(Date.now() / 1000),
          event_id: data.eventId || crypto.randomUUID(),
          user: {
            email: data.user.email ? this.hash(data.user.email) : undefined,
            phone_number: data.user.phone ? this.hash(data.user.phone) : undefined,
            external_id: data.user.externalId ? this.hash(data.user.externalId) : undefined,
            ip: data.user.ip,
            user_agent: data.user.userAgent,
            ttclid: data.user.ttclid,
            ttp: data.user.ttp,
          },
          properties: data.properties,
          context: {
            page: {
              url: data.eventSourceUrl || config.frontendUrl,
            }
          }
        }
      ]
    };

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Access-Token': config.tiktokAccessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.code !== 0) {
        console.error('TikTok API Error:', JSON.stringify(result));
      } else {
        // console.log('TikTok Event Sent:', data.eventName);
      }
    } catch (error) {
      console.error('Failed to send TikTok event:', error);
    }
  }
}
