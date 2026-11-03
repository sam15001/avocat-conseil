// Point d'entrée de l'API : enregistre toutes les routes.
import './routes/auth.mjs';
import './routes/public.mjs';
import './routes/cases.mjs';
import './routes/appointments.mjs';
import './routes/lawyer.mjs';
import './routes/admin.mjs';
import './routes/services.mjs';
import { handle } from './router.mjs';
import { verifySignature, handleInteraction } from './interactions.mjs';
import { json } from './http.mjs';

export const apiHandler = req => handle(req);

export async function interactionsHandler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const raw = await req.text();
  const ok = verifySignature(raw, req.headers.get('x-signature-ed25519'), req.headers.get('x-signature-timestamp'), process.env.DISCORD_PUBLIC_KEY);
  if (!ok) return new Response('invalid request signature', { status: 401 });
  return json(await handleInteraction(JSON.parse(raw)));
}
