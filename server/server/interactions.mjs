// Commandes slash Discord reçues par HTTP (Interactions Endpoint URL).
// Aucun bot connecté en permanence : Discord appelle /api/discord/interactions.
import crypto from 'node:crypto';
import { all, withCache } from './store.mjs';
import { getSettings, roleFromDiscordRoles, SITE_URL } from './config.mjs';
import { getCase, changeStatus, assignCase, canManageCase, stats, isClosed } from './services.mjs';
const recent = (a, b) => String(b.updated_at).localeCompare(String(a.updated_at));
import { HttpError } from './http.mjs';
import { STATUSES, STATUS_BY_KEY, DOMAIN_BY_SLUG } from '../shared/domains.mjs';
import { formatDateFr, linkButtons, welcomeMessage } from './discord.mjs';

// Commandes ouvertes à tous : elles renvoient vers le site
export const PUBLIC_COMMANDS = [
  { name: 'rdv', description: 'Prendre rendez-vous avec un avocat du cabinet' },
  { name: 'demande', description: 'Déposer une demande juridique au cabinet' },
  { name: 'site', description: 'Le site du cabinet : rendez-vous, demandes, suivi de vos dossiers' }
];

export const COMMANDS = [
  ...PUBLIC_COMMANDS,
  { name: 'dossiers', description: 'Lister les nouvelles demandes ou vos dossiers en cours',
    options: [{ type: 3, name: 'filtre', description: 'Quels dossiers afficher', required: false,
      choices: [{ name: 'Nouvelles demandes', value: 'nouvelles' }, { name: 'Mes dossiers', value: 'mes' }, { name: 'Tous les dossiers actifs', value: 'actifs' }] }] },
  { name: 'agenda', description: 'Cabinet : afficher les prochains rendez-vous' },
  { name: 'dossier', description: "Afficher le détail d'un dossier",
    options: [{ type: 3, name: 'numero', description: 'Numéro du dossier (ex. AC-2026-0001)', required: true }] },
  { name: 'attribuer', description: 'Attribuer un dossier à un avocat',
    options: [
      { type: 3, name: 'numero', description: 'Numéro du dossier', required: true },
      { type: 6, name: 'avocat', description: 'Avocat à qui confier le dossier', required: true }] },
  { name: 'statut', description: "Modifier le statut d'un dossier",
    options: [
      { type: 3, name: 'numero', description: 'Numéro du dossier', required: true },
      { type: 3, name: 'statut', description: 'Nouveau statut', required: true, choices: STATUSES.map(s => ({ name: s.label, value: s.key })) },
      { type: 3, name: 'commentaire', description: 'Message transmis au client', required: false }] },
  { name: 'stats', description: 'Nombre de dossiers actifs et statistiques du cabinet' }
];

// Vérification Ed25519 exigée par Discord
export function verifySignature(rawBody, signature, timestamp, publicKeyHex) {
  try {
    if (!signature || !timestamp || !publicKeyHex) return false;
    const key = crypto.createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKeyHex, 'hex')]),
      format: 'der', type: 'spki'
    });
    return crypto.verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signature, 'hex'));
  } catch { return false; }
}

const reply = (content, { embeds, components, ephemeral = true } = {}) =>
  ({ type: 4, data: { content, embeds, components, flags: ephemeral ? 64 : 0, allowed_mentions: { parse: [] } } });

function publicReply(name) {
  const GOLD = 0xB08D57;
  if (name === 'rdv') return reply(null, { embeds: [{ color: GOLD, title: 'Prendre rendez-vous',
    description: 'Les rendez-vous se prennent sur le site, en 1 minute : choisissez le domaine, la prestation, puis un créneau libre. Votre avocat est prévenu aussitôt et vous recevez la confirmation ici en message privé.' }],
    components: linkButtons(['Prendre rendez-vous', '/rendez-vous.html', '📅'], ['Nos honoraires', '/honoraires.html', '⚖️']) });
  if (name === 'demande') return reply(null, { embeds: [{ color: GOLD, title: 'Déposer une demande',
    description: 'Exposez votre situation sur le site et joignez vos preuves. Votre demande reçoit un numéro de dossier et vous suivez chaque étape depuis votre espace client.' }],
    components: linkButtons(['Déposer une demande', '/espace-client.html?nouvelle=1', '📝'], ['Mon espace', '/espace-client.html', '📂']) });
  const w = welcomeMessage();
  return reply(null, { embeds: w.embeds, components: w.components });
}

const opt = (i, name) => i.data.options?.find(o => o.name === name)?.value;
const link = n => `[${n}](${SITE_URL()}/dossier.html?n=${n})`;

async function actorFrom(interaction) {
  const member = interaction.member;
  if (!member) return null; // commande envoyée en message privé
  const settings = await getSettings();
  const discordRole = roleFromDiscordRoles(member.roles || [], settings);
  const site = (await all('users')).find(u => u.discord_id === member.user.id) || null;
  if (site?.disabled) return null;
  return {
    id: site?.id ?? null,
    discord_id: member.user.id,
    username: member.user.username,
    global_name: member.user.global_name,
    rp_name: site?.rp_name,
    role: Math.max(discordRole, site?.site_role ?? 0, site?.discord_role ?? 0)
  };
}

export const handleInteraction = interaction => withCache(() => handleInner(interaction));

async function handleInner(interaction) {
  if (interaction.type === 1) return { type: 1 }; // PING
  if (interaction.type !== 2) return reply('Interaction non prise en charge.');
  if (PUBLIC_COMMANDS.some(c => c.name === interaction.data?.name)) return publicReply(interaction.data.name);

  const actor = await actorFrom(interaction);
  if (!actor) return reply('Utilisez cette commande sur le serveur du cabinet.');
  if (actor.role < 1) return reply("Cette commande est réservée aux membres du cabinet. Pour vos démarches, passez par le site :", { components: linkButtons(['Prendre rendez-vous', '/rendez-vous.html'], ['Mon espace', '/espace-client.html']) });
  const name = interaction.data.name;

  try {
    if (name === 'dossiers') {
      const filtre = opt(interaction, 'filtre') || (actor.role >= 2 ? 'nouvelles' : 'mes');
      let rows;
      if (filtre === 'mes' || actor.role < 2) {
        rows = (await all('cases')).filter(c => c.lawyer_id === (actor.id ?? -1) && !isClosed(c.status)).sort(recent).slice(0, 15);
      } else if (filtre === 'nouvelles') {
        rows = (await all('cases')).filter(c => ['recue', 'attente'].includes(c.status) && !c.archived).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).slice(0, 15);
      } else {
        const L = new Map((await all('lawyers')).map(l => [l.user_id, l]));
        rows = (await all('cases')).filter(c => !isClosed(c.status) && !c.archived).sort(recent).slice(0, 15).map(c => ({ ...c, lawyer: L.get(c.lawyer_id)?.display_name }));
      }
      if (!rows.length) return reply('Aucun dossier à afficher.');
      return reply(null, { embeds: [{ color: 0xB08D57, title: 'Dossiers', description: rows.map(r =>
        `**${link(r.number)}** · ${STATUS_BY_KEY[r.status].label}\n${r.title.slice(0, 80)} — ${DOMAIN_BY_SLUG[r.domain]?.name || r.domain}${r.lawyer ? ` — ${r.lawyer}` : ''}`).join('\n\n') }] });
    }

    if (name === 'agenda') {
      const mine = actor.role < 2;
      const [appts, lawyers, users] = await Promise.all([all('appointments'), all('lawyers'), all('users')]);
      const L = new Map(lawyers.map(l => [l.user_id, l])), U = new Map(users.map(u => [u.id, u]));
      const today = new Date().toISOString().slice(0, 10);
      const rows = appts.filter(a => a.status === 'confirme' && a.date >= today && (!mine || a.lawyer_id === (actor.id ?? -1)))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 15)
        .map(a => { const u = U.get(a.client_id); return { date: a.date, time: a.time, reason: a.reason, lawyer: L.get(a.lawyer_id)?.display_name, client: u ? (u.rp_name || u.global_name || u.username) : '—' }; });
      if (!rows.length) return reply('Aucun rendez-vous à venir.');
      return reply(null, { embeds: [{ color: 0x8A9BA8, title: 'Prochains rendez-vous', description: rows.map(r =>
        `**${formatDateFr(r.date, r.time)}** — ${r.client} avec ${r.lawyer}\n${r.reason.slice(0, 100)}`).join('\n\n') }] });
    }

    if (name === 'dossier') {
      const c = await getCase(opt(interaction, 'numero'));
      if (!c || !canManageCase(actor, c)) return reply('Dossier introuvable ou non attribué à vous.');
      return reply(null, { embeds: [{ color: 0xB08D57, title: c.number, url: `${SITE_URL()}/dossier.html?n=${c.number}`, description: c.description.slice(0, 1000), fields: [
        { name: 'Objet', value: c.title.slice(0, 200) },
        { name: 'Client', value: c.client_name, inline: true },
        { name: 'Statut', value: STATUS_BY_KEY[c.status].label, inline: true },
        { name: 'Avocat', value: c.lawyer_name || 'Non attribué', inline: true }] }] });
    }

    if (name === 'attribuer') {
      if (actor.role < 2) return reply('Seuls les responsables juridiques et la direction peuvent attribuer un dossier.');
      if (!actor.id) return reply("Connectez-vous une fois au site pour lier votre compte avant d'utiliser cette commande.");
      const c = await getCase(opt(interaction, 'numero'));
      if (!c) return reply('Dossier introuvable.');
      const lawyerDiscord = opt(interaction, 'avocat');
      const u = (await all('users')).find(x => x.discord_id === lawyerDiscord);
      const lawyer = u && (await all('lawyers')).find(l => l.user_id === u.id && l.active);
      if (!lawyer) return reply("Ce membre n'a pas de fiche avocat active sur le site.");
      const updated = await assignCase(c, lawyer.user_id, actor);
      return reply(`Dossier ${link(c.number)} attribué à **${updated.lawyer_name}**.`, { ephemeral: false });
    }

    if (name === 'statut') {
      if (!actor.id) return reply("Connectez-vous une fois au site pour lier votre compte avant d'utiliser cette commande.");
      const c = await getCase(opt(interaction, 'numero'));
      if (!c || !canManageCase(actor, c)) return reply('Dossier introuvable ou non attribué à vous.');
      const to = opt(interaction, 'statut');
      await changeStatus(c, to, actor, opt(interaction, 'commentaire') || null);
      return reply(`Dossier ${link(c.number)} : ${STATUS_BY_KEY[c.status].label} → **${STATUS_BY_KEY[to].label}**.`, { ephemeral: false });
    }

    if (name === 'stats') {
      const s = await stats();
      return reply(null, { embeds: [{ color: 0xB08D57, title: 'Activité du cabinet', fields: [
        { name: 'Dossiers actifs', value: String(s.totals.active), inline: true },
        { name: 'En attente', value: String(s.totals.pending), inline: true },
        { name: 'Non attribués', value: String(s.totals.unassigned), inline: true },
        { name: 'Clôturés', value: String(s.totals.closed), inline: true },
        { name: 'Total', value: String(s.totals.total), inline: true },
        { name: 'RDV à venir', value: String(s.appointments.upcoming), inline: true }] }] });
    }
    return reply('Commande inconnue.');
  } catch (e) {
    if (e instanceof HttpError) return reply(e.message);
    console.error('[interactions]', e);
    return reply('Erreur interne, réessayez.');
  }
}
