// Commande /contrat : questionnaire Discord → PDF → signature de l'employeur et du salarié en message privé → validation du cabinet.
import crypto from 'node:crypto';
import { all, rtdb, now } from './store.mjs';
import { getSettings, roleFromDiscordRoles } from './config.mjs';
import { CONTRACT_TYPES, contractStatus, contractPdf, createContract, getContract, signContract, refuseContract, parseBirth, dateFr } from './contracts.mjs';
import { dmFile, channelFile, linkButtons, discordFetch } from './discord.mjs';

const GOLD = 0xB08D57;
export const CONTRACT_COMMAND = {
  name: 'contrat', description: 'Rédiger un contrat de travail (CDI, CDD, CTT) et le faire signer sur Discord',
  options: [
    { type: 3, name: 'type', description: 'Type de contrat', required: true, choices: Object.entries(CONTRACT_TYPES).map(([value, name]) => ({ name, value })) },
    { type: 6, name: 'salarie', description: 'Le salarié (membre du serveur)', required: true },
    { type: 3, name: 'entreprise', description: 'Nom de l’entreprise', required: true, max_length: 80 },
    { type: 3, name: 'poste', description: 'Poste occupé', required: true, max_length: 80 },
    { type: 4, name: 'salaire', description: 'Salaire en $', required: true, min_value: 0, max_value: 100000000 },
    { type: 3, name: 'periodicite', description: 'Salaire par mois (défaut) ou par semaine', required: false, choices: [{ name: 'Par mois', value: 'mois' }, { name: 'Par semaine', value: 'semaine' }] },
    { type: 3, name: 'missions', description: 'Missions, séparées par des « ; »', required: false, max_length: 600 },
    { type: 3, name: 'siege', description: 'Adresse de l’entreprise', required: false, max_length: 120 },
    { type: 3, name: 'lieu', description: 'Lieu de travail (défaut : le siège)', required: false, max_length: 120 },
    { type: 3, name: 'debut', description: 'Date de prise de fonction JJ/MM/AAAA (défaut : aujourd’hui)', required: false, max_length: 10 },
    { type: 3, name: 'duree', description: 'Durée (CDD, CTT), ex. « 3 mois »', required: false, max_length: 60 },
    { type: 4, name: 'essai', description: 'Période d’essai en jours (défaut : 30, 0 = aucune)', required: false, min_value: 0, max_value: 365 },
    { type: 4, name: 'heures', description: 'Heures par semaine (défaut : 40)', required: false, min_value: 1, max_value: 80 },
    { type: 3, name: 'fonction', description: 'Votre fonction dans l’entreprise (défaut : Employeur)', required: false, max_length: 60 }
  ]
};

const eph = (content, extra = {}) => ({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] }, ...extra } });
const opt = (i, n) => i.data.options?.find(o => o.name === n)?.value;
const userOf = i => i.member?.user || i.user;
const nameOf = (u, member) => member?.nick || u?.global_name || u?.username || 'Inconnu';
const filename = c => `${c.ref}.pdf`;
const signButtons = id => [{ type: 1, components: [
  { type: 2, style: 3, label: 'Signer le contrat', custom_id: `csign:${id}`, emoji: { name: '✍️' } },
  { type: 2, style: 4, label: 'Refuser', custom_id: `crefuse:${id}` }] }];

// Qui peut rédiger : l'équipe du cabinet, ou un client ayant l'accès au service de rédaction
async function canDraft(interaction) {
  const u = userOf(interaction);
  const site = (await all('users')).find(x => x.discord_id === u.id) || null;
  if (site?.disabled) return { ok: false, site };
  const role = Math.max(roleFromDiscordRoles(interaction.member?.roles || [], await getSettings()), site?.site_role ?? 0, site?.discord_role ?? 0);
  return { ok: role >= 1 || !!site?.documents_access, site, role };
}

export async function contractCommand(interaction) {
  if (!interaction.member) return eph('Utilisez /contrat sur le serveur du cabinet.');
  const who = await canDraft(interaction);
  if (!who.ok) return eph('La rédaction de contrats est réservée aux entreprises abonnées au service documentaire du cabinet. Contactez-nous pour y souscrire :',
    { components: linkButtons(['Nos honoraires', '/expertises/affaires.html'], ['Prendre rendez-vous', '/rendez-vous.html?domaine=affaires']) });
  const employee = opt(interaction, 'salarie');
  if (employee === userOf(interaction).id) return eph('Le salarié doit être une autre personne que vous : choisissez son compte Discord dans l’option « salarie ».');
  let start = new Date().toISOString().slice(0, 10);
  if (opt(interaction, 'debut')) { start = parseBirth(opt(interaction, 'debut')); if (!start) return eph('Date de prise de fonction invalide : utilisez le format JJ/MM/AAAA.'); }
  const type = opt(interaction, 'type');
  if ((type === 'CDD' || type === 'CTT') && !opt(interaction, 'duree')) return eph('Pour un CDD ou un CTT, indiquez la durée dans l’option « duree » (ex. « 3 mois »).');
  const nonce = crypto.randomBytes(9).toString('base64url');
  await rtdb.put(`drafts/contracts/${nonce}`, {
    type, employee_discord_id: employee, employer_discord_id: userOf(interaction).id, employer_name: who.site?.rp_name || nameOf(userOf(interaction), interaction.member),
    employer_title: opt(interaction, 'fonction') || 'Employeur', company: opt(interaction, 'entreprise'), company_address: opt(interaction, 'siege') || null, position: opt(interaction, 'poste'),
    salary: opt(interaction, 'salaire'), salary_period: opt(interaction, 'periodicite') || 'mois', missions: String(opt(interaction, 'missions') || '').split(';').map(s => s.trim()).filter(Boolean).slice(0, 12),
    workplace: opt(interaction, 'lieu') || null, start_date: start, duration: opt(interaction, 'duree') || null, trial_days: opt(interaction, 'essai') ?? 30, hours: opt(interaction, 'heures') ?? 40,
    requested_by_user_id: who.site?.id ?? null, created_at: now()
  });
  const input = (custom_id, label, { style = 1, required = true, max = 60, placeholder } = {}) =>
    ({ type: 1, components: [{ type: 4, custom_id, label, style, required, max_length: max, ...(placeholder ? { placeholder } : {}) }] });
  return { type: 9, data: { custom_id: `contrat:${nonce}`, title: `${type} — informations du salarié`, components: [
    input('nom', 'Nom du salarié', { max: 40 }), input('prenom', 'Prénom du salarié', { max: 40 }),
    input('naissance', 'Date de naissance (JJ/MM/AAAA)', { max: 10, placeholder: '27/05/2000' }), input('lieu_naissance', 'Lieu de naissance', { max: 60 }),
    input('clauses', 'Clauses particulières (facultatif)', { style: 2, required: false, max: 1500, placeholder: 'Une clause par ligne : véhicule de service, prime, astreinte…' })] } };
}

const field = (i, id) => i.data.components?.flatMap(r => r.components).find(c => c.custom_id === id)?.value?.trim() || '';

export async function contractModal(interaction) {
  const nonce = interaction.data.custom_id.split(':')[1];
  const d = await rtdb.get(`drafts/contracts/${nonce}`);
  if (!d || d.employer_discord_id !== userOf(interaction).id) return eph('Ce questionnaire a expiré. Relancez /contrat.');
  const birth = parseBirth(field(interaction, 'naissance'));
  if (!birth) return eph('Date de naissance invalide : utilisez le format JJ/MM/AAAA. Relancez /contrat.');
  const c = await createContract({ ...d, employee: { last_name: field(interaction, 'nom'), first_name: field(interaction, 'prenom'), birth_date: birth, birth_place: field(interaction, 'lieu_naissance') },
    clauses: field(interaction, 'clauses') || null, missions: d.missions || [] });
  await rtdb.del(`drafts/contracts/${nonce}`);
  const pdf = await contractPdf(c);
  const emp = `${c.employee.first_name} ${c.employee.last_name}`;
  const msg = forWho => ({ embeds: [{ color: GOLD, title: `${CONTRACT_TYPES[c.type]} — ${c.ref}`,
    description: `${forWho}\n\n**Entreprise :** ${c.company}\n**Salarié :** ${emp} · ${c.position}\n**Prise de fonction :** ${dateFr(c.start_date)}\n\nLisez le contrat joint, puis signez-le avec le bouton ci-dessous. Après les deux signatures, un avocat du cabinet le valide et vous recevez la version définitive.`,
    footer: { text: 'Dominion Law Firm - Avocat & Conseil · Signature électronique' } }], components: signButtons(c.id) });
  const [r1, r2] = await Promise.all([
    dmFile(c.employer_discord_id, msg('Votre contrat est prêt : vous signez **pour l’entreprise**.'), filename(c), pdf),
    dmFile(c.employee_discord_id, msg(`**${c.company}** vous propose un contrat de travail : vous signez **en tant que salarié**.`), filename(c), pdf)
  ]);
  await channelFile('requests', { embeds: [{ color: GOLD, title: `Contrat généré — ${c.ref}`, description: `${CONTRACT_TYPES[c.type]}\n**Entreprise :** ${c.company} (${c.employer_name}, <@${c.employer_discord_id}>)\n**Salarié :** ${emp} (<@${c.employee_discord_id}>)\nEn attente des signatures.` }] }, filename(c), pdf);
  const fails = [!r1.ok && 'vous', !r2.ok && `<@${c.employee_discord_id}>`].filter(Boolean);
  return eph(`Contrat **${c.ref}** généré et envoyé en message privé aux deux parties pour signature.${fails.length ? `\n⚠️ Message privé impossible pour ${fails.join(' et ')} : ouvrez vos messages privés (Paramètres de confidentialité du serveur), puis demandez au cabinet de renvoyer le contrat.` : ''}`);
}

export async function contractButton(interaction) {
  const [action, raw] = interaction.data.custom_id.split(':');
  const c = await getContract(Number(raw));
  if (!c) return eph('Contrat introuvable.');
  const u = userOf(interaction);
  const done = text => ({ type: 7, data: { content: text, components: [], allowed_mentions: { parse: [] } } });

  if (action === 'cvalid') {
    if (!interaction.member) return eph('La validation se fait depuis le salon du cabinet.');
    const who = await canDraft(interaction);
    if ((who.role ?? 0) < 1) return eph('Seuls les avocats du cabinet peuvent valider un contrat.');
    if (c.status !== 'validation') return eph(`Ce contrat est « ${contractStatus[c.status]} ».`);
    const lawyer = (await all('lawyers')).find(l => l.user_id === who.site?.id);
    const name = `Maître ${(lawyer?.display_name || who.site?.rp_name || nameOf(u, interaction.member)).replace(/^(Me|Maître)\s+/i, '')}`;
    const v = await signContract(c, 'cabinet', { name, discord_id: u.id });
    const pdf = await contractPdf(v);
    const final = text => ({ embeds: [{ color: 0x8FA67A, title: `Contrat validé — ${v.ref}`, description: text, footer: { text: 'Dominion Law Firm - Avocat & Conseil · Version définitive signée' } }] });
    await Promise.all([
      dmFile(v.employer_discord_id, final(`Le contrat de **${v.employee.first_name} ${v.employee.last_name}** est signé par les deux parties et validé par ${name}. Voici la version définitive.`), filename(v), pdf),
      dmFile(v.employee_discord_id, final(`Votre contrat avec **${v.company}** est signé et validé par ${name}. Voici la version définitive, à conserver.`), filename(v), pdf)
    ]);
    return done(`✅ **${v.ref}** validé par ${name} le ${dateFr(now())}. La version définitive a été envoyée aux deux parties.`);
  }

  const party = u.id === c.employer_discord_id ? 'employer' : u.id === c.employee_discord_id ? 'employee' : null;
  if (!party) return eph('Ce contrat ne vous concerne pas.');
  if (c.status === 'refuse') return done(`Ce contrat a été refusé par ${c.refused_by}.`);
  if (c.signatures?.[party]) return done(`Vous avez déjà signé ce contrat le ${dateFr(c.signatures[party].at)}.`);
  const myName = party === 'employer' ? c.employer_name : `${c.employee.first_name} ${c.employee.last_name}`;

  if (action === 'crefuse') {
    await refuseContract(c, { name: myName });
    const other = party === 'employer' ? c.employee_discord_id : c.employer_discord_id;
    const ch = await discordFetch('/users/@me/channels', { method: 'POST', body: { recipient_id: other } });
    if (ch.ok) await discordFetch(`/channels/${ch.data.id}/messages`, { method: 'POST', body: { content: `❌ Le contrat **${c.ref}** (${c.company}) a été refusé par ${myName}. Il n’est pas valable.`, allowed_mentions: { parse: [] } } });
    return done(`❌ Vous avez refusé le contrat **${c.ref}**. L’autre partie et le cabinet en sont informés.`);
  }

  const s = await signContract(c, party, { name: myName, discord_id: u.id });
  if (s.status === 'validation') {
    const pdf = await contractPdf(s);
    await channelFile('requests', { embeds: [{ color: GOLD, title: `Contrat à valider — ${s.ref}`, description: `Signé par l’entreprise (${s.employer_name}) et par le salarié (${s.employee.first_name} ${s.employee.last_name}). Relisez le contrat joint, puis validez-le pour le cabinet.` }],
      components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Valider pour le cabinet', custom_id: `cvalid:${s.id}`, emoji: { name: '⚖️' } }] }] }, filename(s), pdf);
    return done(`✍️ Signé le ${dateFr(now())}. Les deux parties ont signé : un avocat du cabinet valide maintenant le contrat, puis vous recevrez la version définitive.`);
  }
  return done(`✍️ Signé le ${dateFr(now())}. Le contrat attend encore la signature de ${party === 'employer' ? 'votre salarié' : 'l’entreprise'}.`);
}
