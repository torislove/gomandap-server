import { onRequest } from 'firebase-functions/v2/https';
import app from './index.js';

export const api = onRequest(async (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  const url = new URL(req.originalUrl || req.url, origin);

  const body =
    req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : (req as any).rawBody;

  const webRequest = new Request(url.toString(), {
    method: req.method,
    headers: req.headers as any,
    body,
  });

  const response = await app.fetch(webRequest);

  res.status(response.status);
  for (const [key, value] of (response.headers as any).entries()) {
    res.setHeader(key as any, value as any);
  }
  const ab = await response.arrayBuffer();
  res.send(Buffer.from(ab));
});
