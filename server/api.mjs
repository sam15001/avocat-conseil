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
import { editOriginal } from './discord.mjs';

export const apiHandler = req => handle(req);

export async function interactionsHandler(req, context) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const raw = await req.text();
  const ok = verifySignature(raw, req.headers.get('x-signature-ed25519'), req.headers.get('x-signature-timestamp'), process.env.DISCORD_PUBLIC_KEY);
  if (!ok) return new Response('invalid request signature', { status: 401 });
  const interaction = JSON.parse(raw);
  const r = await handleInteraction(interaction);
  if (r?.after) {
    // Réponse « en cours » envoyée tout de suite, la suite (PDF, messages privés) continue après
    const run = r.after().catch(async e => {
      console.error('[interactions] suite', e);
      await editOriginal(interaction, { content: 'Erreur lors du traitement, réessayez.', components: [] }).catch(() => {});
    });
    if (context?.waitUntil) context.waitUntil(run); else await run;
    return json(r.defer);
  }
  return json(r);
}
