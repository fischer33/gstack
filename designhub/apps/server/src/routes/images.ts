import { Router } from 'express';
import { z } from 'zod';
import { ah, rateLimit } from '../middleware/security';
import { RemovalError, type BackgroundRemover } from '../services/backgroundRemoval';

const MAX_BYTES = 10 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

const body = z.object({ image: z.string().max(Math.ceil((MAX_BYTES * 4) / 3) + 100, 'Das Bild ist größer als 10 MB') });

/** Bildwerkzeuge, die einen externen Dienst brauchen. Jeder Aufruf kostet Guthaben, daher zusätzlich ein enges Limit. */
export function imagesRouter(remover: BackgroundRemover | null) {
  const r = Router();
  const limiter = rateLimit(10, 60_000);

  r.post('/remove-background', limiter, ah(async (req, res) => {
    if (!remover) return void res.status(501).json({ error: 'not_configured' });
    const { image } = body.parse(req.body);
    const m = DATA_URL.exec(image);
    if (!m) return void res.status(400).json({ error: 'unsupported_image' }); // nur PNG, JPEG, WebP als data:-URL
    const input = Buffer.from(m[2], 'base64');
    if (!input.length || input.length > MAX_BYTES) return void res.status(400).json({ error: 'unsupported_image' });
    try {
      const png = await remover.remove(input, m[1]);
      res.json({ image: `data:image/png;base64,${png.toString('base64')}` });
    } catch (err) {
      if (!(err instanceof RemovalError)) throw err;
      const status = err.code === 'invalid_image' ? 422 : err.code === 'quota' ? 402 : 502;
      console.warn('Background removal failed:', err.message);
      res.status(status).json({ error: err.code === 'provider' ? 'provider_error' : err.code });
    }
  }));
  return r;
}
