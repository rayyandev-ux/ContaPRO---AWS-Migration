import Groq from 'groq-sdk';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class GroqService {
  private groq: Groq;

  constructor() {
    this.groq = new Groq({ apiKey: config.groqApiKey });
  }

  /**
   * Transcribe audio using Whisper on Groq (Ultra-fast & cheap)
   */
  async transcribeAudio(fileBuffer: Buffer): Promise<string> {
    const tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.ogg`);
    
    try {
      // Groq SDK needs a file stream or path usually, let's write temp file
      fs.writeFileSync(tempFilePath, fileBuffer);
      
      const transcription = await this.groq.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: config.groqAudioModel, // whisper-large-v3-turbo
        // language: 'es', // Removed to allow auto-detection
        response_format: 'text'
      });

      return transcription as unknown as string; // response_format: 'text' returns string directly usually, or we adjust
    } catch (error) {
      console.error('Groq Transcription Error:', error);
      throw new Error('Falló la transcripción de audio con Groq.');
    } finally {
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch {}
    }
  }

  /**
   * Analyze image using Llama Vision on Groq
   * Returns structured JSON with expense details
   */
  async analyzeImage(imageUrl: string): Promise<any> {
    try {
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analiza esta imagen. Puede ser un DOCUMENTO (Factura, Boleta, Yape, Plin) o una FOTO DE UN PRODUCTO/SERVICIO. Extrae JSON estricto: { "amount": number, "currency": "PEN"|"USD", "date": "YYYY-MM-DD" (si es "hoy" usa la fecha actual), "emitter": "string", "ruc": "string", "categoryName": "string", "description": "string", "type": "FACTURA"|"BOLETA"|"INFORMAL"|"YAPE"|"PLIN"|"BCP"|"INTERBANK"|"BBVA"|"SCOTIABANK", "operation_type": "SENT"|"RECEIVED"|"UNKNOWN", "raw_text_snippet": "string" }. REGLAS: 1. Si es DOCUMENTO: Extrae datos exactos. 2. Si es FOTO DE PRODUCTO: En "description" DESCRIBE LO QUE VES. 3. CASO YAPE/PLIN/BANCOS: Detecta si es GASTO (SENT) o INGRESO (RECEIVED). Busca palabras clave: "Enviaste", "Yapeaste", "Pagaste", "Realizaste" -> SENT. "Recibiste", "Te enviaron", "Abono" -> RECEIVED. 4. En "raw_text_snippet" incluye frases clave detectadas (ej: "Acabas de yapear", "¡Yapeaste!").' },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        model: config.groqVisionModel, // llama-3.2-11b-vision-preview
        temperature: 0,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return null;

      try {
        return JSON.parse(content);
      } catch {
        // Fallback if model returns Markdown wrapper
        const match = content.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
      }

    } catch (error) {
      console.error('Groq Vision Error:', error);
      // Fail gracefully so we can fallback or just ignore
      return null;
    }
  }

  async chatCompletion(messages: any[], jsonMode = true): Promise<string | any> {
    try {
      const completion = await this.groq.chat.completions.create({
        messages,
        model: config.groqModel || 'llama-3.3-70b-versatile',
        temperature: 0,
        response_format: jsonMode ? { type: 'json_object' } : undefined
      });
      const content = completion.choices[0]?.message?.content || '';
      
      if (jsonMode) {
         try {
            return JSON.parse(content);
         } catch {
            const match = content.match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : null;
         }
      }
      return content;
    } catch (e) {
      console.error('Groq Chat Error:', e);
      return null;
    }
  }
}
