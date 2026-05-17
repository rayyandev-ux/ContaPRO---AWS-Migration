import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { isEntitled } from '../utils/subscription.js';
import { requireAuth } from '../utils/auth.js';
import { generatePresignedDownloadUrl } from '../services/aws.js';

export const documentsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:id/download', { schema: { summary: 'Descargar documento' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');
    const id = (req.params as any).id as string;
    const doc = await app.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.userId !== userId) return res.notFound('No encontrado');
    if (doc.profileId && doc.profileId !== profileId) return res.notFound('No encontrado (perfil incorrecto)');
    if (!doc.storagePath) return res.badRequest('Documento sin archivo');

    try {
      // Si el backend tiene S3 configurado, y el path parece ser de S3 o al menos generamos la url
      if (process.env.S3_BUCKET_NAME) {
        // En caso de que el storagePath incluya una ruta local por compatibilidad legacy, limpiarla
        const key = doc.storagePath.includes('/') ? doc.storagePath.split('uploads/').pop() || doc.storagePath : doc.storagePath;
        const bucket = process.env.S3_BUCKET_NAME;
        const url = await generatePresignedDownloadUrl(bucket, `uploads/${key}`, 900);
        return res.redirect(url);
      }

      let file: Buffer;
      let usedPath = doc.storagePath;

      // 1. Try primary path (handling relative/absolute)
      if (!path.isAbsolute(usedPath)) {
        usedPath = path.join(process.cwd(), usedPath);
      }

      try {
        file = await fs.readFile(usedPath);
      } catch (e) {
        // 2. Fallback: Try to find the file in local uploads directory
        // Robust filename extraction handling both / and \ separators
        const filename = doc.storagePath.split(/[/\\]/).pop();
        if (!filename) throw e;

        const fallbackPath = path.join(process.cwd(), 'uploads', filename);
        app.log.warn({ msg: 'Primary storage path failed, trying fallback', original: doc.storagePath, fallback: fallbackPath });
        
        try {
          file = await fs.readFile(fallbackPath);
        } catch (e2) {
           // Si falla también el fallback, devolvemos 404
           app.log.error({ msg: 'Fallback storage path also failed', fallback: fallbackPath, error: String(e2) });
           // return res.notFound('Archivo no encontrado en el servidor');
           // DEBUG INFO for User
           return res.status(404).send({ 
             error: 'File not found', 
             details: `Could not find file at ${usedPath} or ${fallbackPath}`,
             cwd: process.cwd()
           });
        }
      }

      res.header('Content-Type', doc.mimeType);
      const safeName = doc.filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
      res.header('Content-Disposition', `attachment; filename="${safeName}"`);
      return res.send(file);
    } catch (e) {
      app.log.error(e);
      // return res.internalServerError('No se pudo leer el archivo');
      // DEBUG INFO for User
      return res.status(500).send({ 
        error: 'Internal Server Error reading file', 
        details: String(e),
        stack: (e as any).stack,
        cwd: process.cwd()
      });
    }
  });

  // Vista previa inline del documento (útil para imágenes)
  app.get('/:id/preview', { schema: { summary: 'Previsualizar documento' } }, async (req, res) => {
    const auth = await requireAuth(app, req, res);
    if (!auth) return;
    const { userId, profileId } = auth;
    const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpires: true, trialEnds: true } });
    if (!isEntitled(user)) return res.paymentRequired('Suscripción requerida');
    const id = (req.params as any).id as string;
    const doc = await app.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.userId !== userId) return res.notFound('No encontrado');
    if (doc.profileId && doc.profileId !== profileId) return res.notFound('No encontrado (perfil incorrecto)');
    if (!doc.storagePath) return res.badRequest('Documento sin archivo');

    try {
      // Si el backend tiene S3 configurado, redirigir a S3 presigned URL
      if (process.env.S3_BUCKET_NAME) {
        const key = doc.storagePath.includes('/') ? doc.storagePath.split('uploads/').pop() || doc.storagePath : doc.storagePath;
        const bucket = process.env.S3_BUCKET_NAME;
        const url = await generatePresignedDownloadUrl(bucket, `uploads/${key}`, 900);
        return res.redirect(url);
      }

      let file: Buffer;
      let usedPath = doc.storagePath;

      // 1. Try primary path (handling relative/absolute)
      if (!path.isAbsolute(usedPath)) {
        usedPath = path.join(process.cwd(), usedPath);
      }

      try {
        file = await fs.readFile(usedPath);
      } catch (e) {
        // 2. Fallback: Try to find the file in local uploads directory
        // Robust filename extraction handling both / and \ separators
        const filename = doc.storagePath.split(/[/\\]/).pop();
        if (!filename) throw e;

        const fallbackPath = path.join(process.cwd(), 'uploads', filename);
        app.log.warn({ msg: 'Primary storage path failed, trying fallback', original: doc.storagePath, fallback: fallbackPath });
        
        try {
          file = await fs.readFile(fallbackPath);
        } catch (e2) {
            // Si falla también el fallback, devolvemos 404
            app.log.error({ msg: 'Fallback storage path also failed', fallback: fallbackPath, error: String(e2) });
            // return res.notFound('Archivo no encontrado en el servidor');
            // DEBUG INFO for User
            return res.status(404).send({ 
              error: 'File not found', 
              details: `Could not find file at ${usedPath} or ${fallbackPath}`,
              cwd: process.cwd()
            });
        }
      }

      const safeName = doc.filename.replace(/[^a-zA-Z0-9_.-]/g, '_');

      // Para vista previa, intentamos normalizar imágenes móviles (HEIC/HEIF/TIFF/BMP, etc.)
      // y corregir orientación EXIF. Mantiene el original para descarga.
      let outBuf: Buffer = file;
      let outMime: string = doc.mimeType;

      const isImage = (doc.mimeType || '').startsWith('image/');
      const isWebFriendly = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((doc.mimeType || '').toLowerCase());
      if (isImage) {
        try {
          const pipeline = sharp(file)
            .rotate() // respeta orientación EXIF
            // Para mejorar la experiencia de vista previa, permitir escalar imágenes pequeñas
            .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: false }); // previene imágenes gigantes y amplía si es muy pequeña

          if (isWebFriendly) {
            // Mantener formato original para preview, sólo corrigiendo orientación
            outBuf = await pipeline.toBuffer();
            outMime = doc.mimeType;
          } else {
            // Convertir a PNG para navegadores que no soportan HEIC/HEIF/TIFF/BMP
            outBuf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
            outMime = 'image/png';
          }
        } catch (e) {
          // Si falla la decodificación (p.ej., formato no soportado), devolvemos el archivo original
          app.log.warn({ msg: 'preview: image transform failed, sending original', id, mimeType: doc.mimeType, error: String(e) });
          outBuf = file;
          outMime = doc.mimeType;
        }
      }

      res.header('Content-Type', outMime);
      // inline para permitir que el navegador intente renderizar (imágenes, pdf)
      res.header('Content-Disposition', `inline; filename="${safeName}"`);
      return res.send(outBuf);
    } catch (e) {
      app.log.error(e);
      return res.internalServerError('No se pudo leer el archivo');
    }
  });
};