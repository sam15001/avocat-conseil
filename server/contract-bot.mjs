// Commande /contrat : questionnaire Discord → PDF → signature de l'employeur et du salarié en message privé → validation du cabinet.
import crypto from 'node:crypto';
import { all, rtdb, now } from './store.mjs';
import { getSettings, roleFromDiscordRoles } from './config.mjs';
import { CONTRACT_TYPES, contractStatus, contractPdf, createContract, getContract, signContract, refuseContract, parseBirth, dateFr } from './contracts.mjs';
import { dmFile, channelFile, linkButtons, discordFetch, editOriginal } from './discord.mjs';

const GOLD = 0xB08D57;
export const CONTRACT_COMMAND = {
  name: 'contrat', description: 'Rédiger un contrat de travail (CDI, CDD, CTT) et le faire signer sur Discord',
  options: [{ type: 6, name: 'salarie', description: 'Le salarié (membre du serveur)', required: true }]
};

// Texte à compléter : une ligne « Rubrique : valeur » par information
export const TEMPLATE = [
  ['type', 'Type de contrat (CDI, CDD ou CTT)', 'CDI'],
  ['company', 'Entreprise', ''],
  ['company_address', 'Adresse de l’entreprise', ''],
  ['employer_title', 'Votre fonction', 'PDG'],
  ['last_name', 'Nom du salarié', ''],
  ['first_name', 'Prénom du salarié', ''],
  ['birth_date', 'Date de naissance (JJ/MM/AAAA)', ''],
  ['birth_place', 'Lieu de naissance', ''],
  ['position', 'Poste', ''],
  ['salary', 'Salaire ($)', ''],
  ['salary_period', 'Salaire par (mois ou semaine)', 'mois'],
  ['missions', 'Missions (séparées par ;)', ''],
  ['workplace', 'Lieu de travail', ''],
  ['start_date', 'Date de début (JJ/MM/AAAA)', ''],
  ['duration', 'Durée (CDD ou CTT, ex. 3 mois)', ''],
  ['trial_days', 'Période d’essai (jours)', '30'],
  ['hours', 'Heures par semaine', '40']
];
const templateText = (vals = {}) => TEMPLATE.map(([k, label, def]) => `${label} : ${vals[k] ?? def}`).join('\n');
const keyNorm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
const KEYS = new Map(TEMPLATE.map(([k, label]) => [keyNorm(label), k]));

// Lit le texte rempli → { valeurs, erreurs }
export function parseContractText(text) {
  const v = {};
  for (const line of String(text).split('\n')) {
    const i = line.indexOf(':'); if (i < 0) continue;
    const k = KEYS.get(keyNorm(line.slice(0, i))); if (k) v[k] = line.slice(i + 1).trim();
  }
  const err = [];
  const type = String(v.type || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!CONTRACT_TYPES[type]) err.push('Type de contrat : CDI, CDD ou CTT');
  for (const [k, label] of [['company', 'Entreprise'], ['last_name', 'Nom du salarié'], ['first_name', 'Prénom du salarié'], ['birth_place', 'Lieu de naissance'], ['position', 'Poste']])
    if (!v[k]) err.push(`${label} : à remplir`);
  const birth = parseBirth(v.birth_date); if (!birth) err.push('Date de naissance : format JJ/MM/AAAA');
  const salary = Number(String(v.salary || '').replace(/[^\d]/g, '')); if (!v.salary || !/\d/.test(v.salary)) err.push('Salaire : un montant en $');
  let start = new Date().toISOString().slice(0, 10);
  if (v.start_date) { start = parseBirth(v.start_date); if (!start) err.push('Date de début : format JJ/MM/AAAA'); }
  if ((type === 'CDD' || type === 'CTT') && !v.duration) err.push('Durée : obligatoire pour un CDD ou un CTT');
  const num = (x, d, min, max) => { const n = parseInt(String(x ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  return { err, values: v, data: {
    type, company: v.company, company_address: v.company_address || null, employer_title: v.employer_title || 'Employeur', position: v.position,
    salary, salary_period: /sem/i.test(v.salary_period || '') ? 'semaine' : 'mois',
    missions: String(v.missions || '').split(';').map(x => x.trim()).filter(Boolean).slice(0, 12), workplace: v.workplace || null,
    start_date: start, duration: v.duration || null, trial_days: num(v.trial_days, 30, 0, 365), hours: num(v.hours, 40, 1, 80),
    employee: { last_name: v.last_name, first_name: v.first_name, birth_date: birth, birth_place: v.birth_place }
  } };
}

const contractModalFor = (employeeId, text, clauses = '') => ({ type: 9, data: { custom_id: `contrat:${employeeId}`, title: 'Contrat de travail', components: [
  { type: 1, components: [{ type: 4, custom_id: 'formulaire', label: 'Complétez chaque ligne après les « : »', style: 2, required: true, max_length: 4000, value: text }] },
  { type: 1, components: [{ type: 4, custom_id: 'clauses', label: 'Clauses particulières (facultatif)', style: 2, required: false, max_length: 1500, ...(clauses ? { value: clauses } : {}), placeholder: 'Une clause par ligne : véhicule de service, prime, astreinte…' }] }] } });

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
  const employee = opt(interaction, 'salarie');
  if (employee === userOf(interaction).id) return eph('Le salarié doit être une autre personne que vous : choisissez son compte Discord dans l’option « salarie ».');
  // Discord attend la fenêtre en moins de 3 secondes : l'accès est vérifié ici si la base répond vite, sinon à l'envoi
  const who = await Promise.race([canDraft(interaction), new Promise(ok => setTimeout(() => ok(null), 1500))]);
  if (who && !who.ok) return refusal();
  return contractModalFor(employee, templateText());
}
const refusal = () => eph('La rédaction de contrats est réservée aux entreprises abonnées au service documentaire du cabinet. Contactez-nous pour y souscrire :',
  { components: linkButtons(['Nos honoraires', '/expertises/affaires.html'], ['Prendre rendez-vous', '/rendez-vous.html?domaine=affaires']) });

const field = (i, id) => i.data.components?.flatMap(r => r.components).find(c => c.custom_id === id)?.value?.trim() || '';

export function contractModal(interaction) {
  // Réponse immédiate, puis vérification et envoi du PDF
  return { defer: { type: 5, data: { flags: 64 } }, after: async () => editOriginal(interaction, (await submitContract(interaction)).data) };
}

async function submitContract(interaction) {
  const employee = interaction.data.custom_id.split(':')[1];
  const who = await canDraft(interaction);
  if (!who.ok) return refusal();
  const text = field(interaction, 'formulaire'), clauses = field(interaction, 'clauses');
  const { err, data } = parseContractText(text);
  if (err.length) {
    const nonce = crypto.randomBytes(9).toString('base64url');
    await rtdb.put(`drafts/contracts/${nonce}`, { employee, employer: userOf(interaction).id, text, clauses, created_at: now() });
    return eph(`Il manque des informations :\n${err.map(e => `• ${e}`).join('\n')}`,
      { components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Corriger le formulaire', custom_id: `cedit:${nonce}` }] }] });
  }
  const c = await createContract({ ...data, clauses: clauses || null, employee_discord_id: employee, employer_discord_id: userOf(interaction).id,
    employer_name: who.site?.rp_name || nameOf(userOf(interaction), interaction.member), requested_by_user_id: who.site?.id ?? null });
  return sendForSignature(c);
}

// Rouvre le formulaire avec le texte déjà saisi
export async function contractEdit(interaction) {
  const d = await rtdb.get(`drafts/contracts/${interaction.data.custom_id.split(':')[1]}`);
  if (!d || d.employer !== userOf(interaction).id) return eph('Ce brouillon a expiré. Relancez /contrat.');
  return contractModalFor(d.employee, d.text, d.clauses);
}

async function sendForSignature(c) {
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
    return { defer: { type: 6 }, after: async () => editOriginal(interaction, (await finalize(v, name)).data) };
  }
  return partyButton(interaction, action, c, u, done);
}

async function finalize(v, name) {
  const done = text => ({ type: 7, data: { content: text, components: [] } });
  {
    const pdf = await contractPdf(v);
    const final = text => ({ embeds: [{ color: 0x8FA67A, title: `Contrat validé — ${v.ref}`, description: text, footer: { text: 'Dominion Law Firm - Avocat & Conseil · Version définitive signée' } }] });
    await Promise.all([
      dmFile(v.employer_discord_id, final(`Le contrat de **${v.employee.first_name} ${v.employee.last_name}** est signé par les deux parties et validé par ${name}. Voici la version définitive.`), filename(v), pdf),
      dmFile(v.employee_discord_id, final(`Votre contrat avec **${v.company}** est signé et validé par ${name}. Voici la version définitive, à conserver.`), filename(v), pdf)
    ]);
    return done(`✅ **${v.ref}** validé par ${name} le ${dateFr(now())}. La version définitive a été envoyée aux deux parties.`);
  }
}

async function partyButton(interaction, action, c, u, done) {
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
  if (s.status === 'validation') return { defer: { type: 6 }, after: async () => editOriginal(interaction, (await toCabinet(s)).data) };
  return done(`✍️ Signé le ${dateFr(now())}. Le contrat attend encore la signature de ${party === 'employer' ? 'votre salarié' : 'l’entreprise'}.`);
}

async function toCabinet(s) {
  const done = text => ({ type: 7, data: { content: text, components: [] } });
  {
    const pdf = await contractPdf(s);
    await channelFile('requests', { embeds: [{ color: GOLD, title: `Contrat à valider — ${s.ref}`, description: `Signé par l’entreprise (${s.employer_name}) et par le salarié (${s.employee.first_name} ${s.employee.last_name}). Relisez le contrat joint, puis validez-le pour le cabinet.` }],
      components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Valider pour le cabinet', custom_id: `cvalid:${s.id}`, emoji: { name: '⚖️' } }] }] }, filename(s), pdf);
    return done(`✍️ Signé le ${dateFr(now())}. Les deux parties ont signé : un avocat du cabinet valide maintenant le contrat, puis vous recevrez la version définitive.`);
  }
}
