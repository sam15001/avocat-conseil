// Bot Discord en mode REST : aucun processus permanent nécessaire.
// Le token du bot n'est utilisé que côté serveur (fonctions Netlify).
import { DISCORD_API, SITE_URL, getSettings } from './config.mjs';
import { STATUS_BY_KEY, DOMAIN_BY_SLUG } from '../shared/domains.mjs';

const GOLD = 0xB08D57;
const COLORS = { requests: GOLD, appointments: 0x8A9BA8, active: 0xC9A96E, closed: 0x6B6B6B, admin: 0x9E4B3C };

export async function discordFetch(path, { method = 'GET', body, bot = true, token, form } = {}) {
  const headers = {};
  if (bot) headers.authorization = `Bot ${process.env.DISCORD_BOT_TOKEN}`;
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString(); }
  else if (body) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(DISCORD_API() + path, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// Envoi dans un salon configuré. Ne bloque jamais l'action principale en cas d'échec.
export async function notify(channelKey, embed) {
  try {
    if (!process.env.DISCORD_BOT_TOKEN) return { skipped: 'no-token' };
    const settings = await getSettings();
    const channel = settings[`channel_${channelKey}`];
    if (!channel) return { skipped: 'no-channel' };
    const r = await discordFetch(`/channels/${channel}/messages`, {
      method: 'POST',
      body: { embeds: [{ color: COLORS[channelKey] ?? GOLD, timestamp: new Date().toISOString(), footer: { text: 'AVOCAT & CONSEIL' }, ...embed }], allowed_mentions: { parse: [] } }
    });
    if (!r.ok) console.error('[discord] notify', channelKey, r.status, r.data);
    return r;
  } catch (e) {
    console.error('[discord] notify error', e.message);
    return { error: e.message };
  }
}

// Message privé de confirmation (le citoyen doit partager un serveur avec le bot)
// Rangée de boutons-liens vers le site : linkButtons(['Prendre rendez-vous', '/rendez-vous.html'], …)
export function linkButtons(...links) {
  return [{ type: 1, components: links.slice(0, 5).map(([label, path, emoji]) => ({ type: 2, style: 5, label, url: SITE_URL() + path, ...(emoji ? { emoji: { name: emoji } } : {}) })) }];
}

// Message d'accueil du serveur : tout passe par le site
export function welcomeMessage() {
  return {
    embeds: [{
      color: GOLD,
      title: 'AVOCAT & CONSEIL — Cabinet d’avocats à Los Santos',
      description: [
        'Toutes les démarches se font sur **notre site** : c’est là que votre dossier reçoit un numéro et que vous suivez son avancement.',
        '',
        '**Prendre rendez-vous** : choisissez le domaine, la prestation, puis un créneau libre. Confirmation immédiate.',
        '**Déposer une demande** : exposez votre situation et joignez vos preuves.',
        '**Mon espace** : vos dossiers, vos rendez-vous et les messages de votre avocat.',
        '',
        'Connexion en un clic avec votre compte Discord. Les demandes envoyées ici en message ne sont pas traitées.'
      ].join('\n'),
      footer: { text: 'Tapez /rdv, /demande ou /site à tout moment pour retrouver ces liens.' }
    }],
    components: linkButtons(['Prendre rendez-vous', '/rendez-vous.html', '📅'], ['Déposer une demande', '/espace-client.html?nouvelle=1', '📝'],
      ['Mon espace', '/espace-client.html', '📂'], ['Nos honoraires', '/honoraires.html', '⚖️']),
    allowed_mentions: { parse: [] }
  };
}

export async function postMessage(channelId, body) {
  if (!process.env.DISCORD_BOT_TOKEN) return { ok: false, status: 0 };
  return discordFetch(`/channels/${channelId}/messages`, { method: 'POST', body });
}

export async function dm(discordId, embed, buttons = [['Ouvrir mon espace client', '/espace-client.html']]) {
  try {
    if (!/^\d{15,22}$/.test(discordId || '')) return { skipped: 'no-discord' };
    if (!process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_DM_CONFIRMATIONS === 'false') return { skipped: true };
    const ch = await discordFetch('/users/@me/channels', { method: 'POST', body: { recipient_id: discordId } });
    if (!ch.ok) return ch;
    return await discordFetch(`/channels/${ch.data.id}/messages`, {
      method: 'POST', body: { embeds: [{ color: GOLD, footer: { text: 'AVOCAT & CONSEIL' }, ...embed }], ...(buttons?.length ? { components: linkButtons(...buttons) } : {}) }
    });
  } catch (e) { return { error: e.message }; }
}

const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '—');
const domainName = slug => DOMAIN_BY_SLUG[slug]?.name || slug;
const statusLabel = key => STATUS_BY_KEY[key]?.label || key || '—';
export const mention = discordId => /^\d{15,22}$/.test(discordId || '') ? `<@${discordId}>` : '—';

export function formatDateFr(date, time) {
  const [y, m, d] = String(date).slice(0, 10).split('-');
  return `${d}/${m}/${y}${time ? ' à ' + String(time).slice(0, 5) : ''}`;
}

export const embeds = {
  newCase: (c, client) => ({
    title: `Nouvelle demande — ${c.number}`,
    url: `${SITE_URL()}/dossier.html?n=${c.number}`,
    description: trunc(c.description, 900),
    fields: [
      { name: 'Citoyen', value: `${client.rp_name || client.global_name || client.username}`, inline: true },
      { name: 'Discord', value: `${mention(client.discord_id)} (${client.discord_id})`, inline: true },
      { name: 'Domaine', value: domainName(c.domain), inline: true },
      ...(c.service ? [{ name: 'Prestation', value: trunc(c.service, 200), inline: true }] : []),
      ...(c.auto_lawyer ? [{ name: 'Avocat référent', value: c.auto_lawyer, inline: true }] : []),
      { name: 'Objet', value: trunc(c.title, 200) },
      { name: 'Reçue le', value: `<t:${Math.floor(new Date(c.created_at).getTime() / 1000)}:F>`, inline: true },
      { name: 'Dossier', value: `[Ouvrir sur le site](${SITE_URL()}/dossier.html?n=${c.number})`, inline: true }
    ]
  }),
  newAppointment: (a, client, lawyerName) => ({
    title: 'Nouveau rendez-vous',
    fields: [
      { name: 'Citoyen', value: `${client.rp_name || client.global_name || client.username} (${mention(client.discord_id)})`, inline: true },
      { name: 'Avocat', value: lawyerName, inline: true },
      { name: 'Date', value: formatDateFr(a.date, a.time), inline: true },
      { name: 'Domaine', value: domainName(a.domain), inline: true },
      ...(a.service ? [{ name: 'Prestation', value: trunc(a.service, 200), inline: true }] : []),
      ...(a.case_number ? [{ name: 'Dossier', value: a.case_number, inline: true }] : []),
      { name: 'Motif', value: trunc(a.reason, 500) }
    ]
  }),
  cancelAppointment: (a, who, lawyerName) => ({
    title: 'Rendez-vous annulé',
    fields: [
      { name: 'Date', value: formatDateFr(a.date, a.time), inline: true },
      { name: 'Avocat', value: lawyerName, inline: true },
      { name: 'Annulé par', value: who, inline: true }
    ]
  }),
  statusChange: (c, from, to, lawyerName, by, message) => ({
    title: `Mise à jour — ${c.number}`,
    url: `${SITE_URL()}/dossier.html?n=${c.number}`,
    fields: [
      { name: 'Ancien statut', value: statusLabel(from), inline: true },
      { name: 'Nouveau statut', value: statusLabel(to), inline: true },
      { name: 'Avocat responsable', value: lawyerName || 'Non attribué', inline: true },
      { name: 'Modifié par', value: by, inline: true },
      ...(message ? [{ name: 'Commentaire', value: trunc(message, 500) }] : [])
    ]
  }),
  assign: (c, lawyerName, by) => ({
    title: `Dossier attribué — ${c.number}`,
    url: `${SITE_URL()}/dossier.html?n=${c.number}`,
    fields: [
      { name: 'Avocat', value: lawyerName, inline: true },
      { name: 'Domaine', value: domainName(c.domain), inline: true },
      { name: 'Attribué par', value: by, inline: true }
    ]
  }),
  lawyerRefused: (c, lawyerName, reason) => ({
    title: `Prise en charge refusée — ${c.number}`,
    description: `${lawyerName} a refusé le dossier. Il doit être réattribué.`,
    fields: reason ? [{ name: 'Motif', value: trunc(reason, 500) }] : []
  }),
  application: (a) => ({
    title: 'Nouvelle candidature',
    fields: [
      { name: 'Nom RP', value: a.rp_name, inline: true },
      { name: 'Poste', value: a.position, inline: true },
      { name: 'Contact', value: trunc(a.contact, 100), inline: true },
      { name: 'Motivation', value: trunc(a.motivation, 800) }
    ]
  }),
  contact: (m) => ({
    title: `Message de contact — ${trunc(m.subject, 80)}`,
    description: trunc(m.message, 900),
    fields: [{ name: 'De', value: `${m.name} (${trunc(m.contact, 100)})` }]
  })
};

// Canal à utiliser pour une mise à jour de statut
export const channelForStatus = s => (s === 'cloture' || s === 'refuse') ? 'closed' : 'active';
