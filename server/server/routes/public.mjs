import { route } from '../router.mjs';
import { json, readJson, str, int, fail } from '../http.mjs';
import { all, get, insert, allAvailability, getBlob } from '../store.mjs';
import { notify, embeds } from '../discord.mjs';
import { freeSlots } from '../services.mjs';
import { photoUrl } from './lawyer.mjs';
import { DOMAIN_BY_SLUG } from '../../shared/domains.mjs';

route('GET', '/api/public/lawyers', async ({ query }) => {
  const domain = query.get('domain');
  const [lawyers, cases, avail] = await Promise.all([all('lawyers'), all('cases'), allAvailability()]);
  const rows = lawyers.filter(l => l.active && (!domain || l.specialties.includes(domain)))
    .sort((a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name))
    .map(l => {
      const slots = avail[l.user_id] || [];
      return {
        id: l.user_id, display_name: l.display_name, first_name: l.first_name, last_name: l.last_name, title: l.title,
        specialties: l.specialties, bio: l.bio, accepts_appointments: l.accepts_appointments,
        photo: photoUrl({ ...l, has_photo: !!l.photo_mime }),
        phone: l.show_contact ? l.phone : null, email: l.show_contact ? l.email : null,
        cases_closed: cases.filter(c => c.lawyer_id === l.user_id && c.status === 'cloture').length,
        has_availability: slots.length > 0,
        weekdays: [...new Set(slots.map(s => s.weekday))]
      };
    });
  return json({ lawyers: rows });
});

route('GET', '/api/public/lawyers/:id/photo', async ({ params }) => {
  const id = int(params.id, 'id');
  const l = await get('lawyers', id);
  const data = l && l.active && l.photo_mime ? await getBlob(`photos/${id}`) : null;
  if (!data) fail(404, 'Photo introuvable.');
  return new Response(Buffer.from(data, 'base64'), { headers: {
    'content-type': l.photo_mime, 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox"
  } });
});

const publishedNews = async () => (await all('news')).filter(n => n.published).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

route('GET', '/api/public/news', async ({ query }) => {
  const limit = Math.min(int(query.get('limit') || 20, 'limit'), 50);
  const news = (await publishedNews()).slice(0, limit).map(({ slug, title, category, excerpt, created_at }) => ({ slug, title, category, excerpt, created_at }));
  return json({ news });
});

route('GET', '/api/public/news/:slug', async ({ params }) => {
  const n = (await publishedNews()).find(x => x.slug === params.slug);
  if (!n) fail(404, 'Article introuvable.');
  const { slug, title, category, excerpt, body, created_at } = n;
  return json({ article: { slug, title, category, excerpt, body, created_at } });
});

route('GET', '/api/public/slots', async ({ query }) => {
  const lawyer = int(query.get('lawyer'), 'avocat');
  const date = query.get('date');
  const today = todayInTz();
  if (date < today) return json({ slots: [] });
  let slots = await freeSlots(lawyer, date);
  if (date === today) { const now = nowTimeInTz(); slots = slots.filter(s => s.time > now); }
  return json({ slots });
});

route('POST', '/api/public/contact', async ({ req, user }) => {
  const b = await readJson(req, 20000);
  if (b.website) return json({ ok: true }); // pot de miel anti-robot
  const m = {
    name: str(b.name, 'Nom', { max: 80 }),
    contact: str(b.contact, 'Moyen de contact', { max: 120 }),
    subject: str(b.subject, 'Objet', { max: 120 }),
    message: str(b.message, 'Message', { min: 10, max: 3000 })
  };
  await insert('contact_messages', { user_id: user?.id || null, ...m, handled: false });
  await notify('admin', embeds.contact(m));
  return json({ ok: true }, 201);
});

route('POST', '/api/public/applications', async ({ req, user }) => {
  const b = await readJson(req, 20000);
  if (b.website) return json({ ok: true });
  const a = {
    rp_name: str(b.rp_name, 'Nom RP', { max: 80 }),
    contact: str(b.contact, 'Contact', { max: 120 }),
    position: str(b.position, 'Poste', { max: 80 }),
    experience: str(b.experience, 'Expérience', { max: 3000, optional: true }) || '',
    motivation: str(b.motivation, 'Motivation', { min: 30, max: 4000 })
  };
  await insert('applications', { user_id: user?.id || null, ...a, status: 'nouvelle' });
  await notify('admin', embeds.application(a));
  return json({ ok: true }, 201);
});

route('GET', '/api/public/domains/:slug', async ({ params }) => {
  if (!DOMAIN_BY_SLUG[params.slug]) fail(404, 'Domaine inconnu.');
  return json({ domain: DOMAIN_BY_SLUG[params.slug] });
});

// Date / heure dans le fuseau du cabinet
export function todayInTz() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.CABINET_TIMEZONE || 'Europe/Paris' }).format(new Date());
}
export function nowTimeInTz() {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: process.env.CABINET_TIMEZONE || 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}
