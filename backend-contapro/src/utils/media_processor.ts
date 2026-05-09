import type { GroqService } from '../services/groq.js';

/**
 * Procesa un buffer de audio (ej. OGG de Telegram o WhatsApp) 
 * y devuelve su transcripción usando Groq/Whisper.
 */
export async function processAudioBuffer(buffer: Buffer, groqService: GroqService): Promise<string | null> {
  try {
    const text = await groqService.transcribeAudio(buffer);
    return text || null;
  } catch (error) {
    console.error('[media_processor] Error procesando audio:', error);
    return null;
  }
}
