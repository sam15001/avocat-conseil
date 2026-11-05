// Contrats de travail générés depuis Discord (/contrat) : PDF, signatures employeur et salarié, validation du cabinet.
// Le contenu ne cite que des textes publiés de FratWorld (décret 2026-011 sur la tenue de travail, CGI 220-4 sur les salaires).
import site from '../site.config.mjs';
import { all, get, insert, update, now, nextId, addEvent } from './store.mjs';

export const CONTRACT_TYPES = {
  CDI: 'Contrat à Durée Indéterminée (CDI)',
  CDD: 'Contrat à Durée Déterminée (CDD)',
  CTT: 'Contrat de Travail Temporaire (CTT)'
};
export const contractStatus = { signature: 'En attente des signatures', validation: 'En attente de validation du cabinet', valide: 'Validé', refuse: 'Refusé' };

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const dateFr = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${Number(d) === 1 ? '1er' : Number(d)} ${MONTHS[Number(m) - 1]} ${y}`; };
const money = n => `${Number(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} $`;
// Les polices standard du PDF ne couvrent que le jeu WinAnsi : on remplace le reste
const clean = s => String(s ?? '').replace(/[  ]/g, ' ').replace(/[^\x20-\x7E¡-ÿ€‘’“”«»–—…•œŒŠšŽžŸ]/g, '').trim();

// « 27/05/2000 », « 27-05-2000 », « 2000-05-27 » → AAAA-MM-JJ (ou null)
export function parseBirth(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? t : null;
}

// ── Texte du contrat (articles)
function articles(c) {
  const T = c.type, emp = `${c.employee.first_name} ${c.employee.last_name}`;
  const nature = {
    CDI: 'un Contrat de Travail à Durée Indéterminée. La relation de travail se poursuit sans terme prédéterminé ; chacune des parties peut y mettre fin dans le respect du préavis prévu à l’article Rupture du contrat.',
    CDD: `un Contrat de Travail à Durée Déterminée${c.duration ? `, conclu pour une durée de ${c.duration}` : ''}. Le contrat prend fin à l’échéance de ce terme, sauf renouvellement par avenant écrit signé des deux parties.`,
    CTT: `un Contrat de Travail Temporaire${c.duration ? ` pour une mission d’une durée de ${c.duration}` : ''}. Le contrat prend fin à l’issue de la mission, sauf prolongation par avenant écrit signé des deux parties.`
  }[T];
  const out = [
    ['Engagement et nature du contrat', [
      'Entre les soussignés :',
      `L’Entreprise ${c.company}${c.company_address ? `, ayant son siège à ${c.company_address}` : ''}, représentée par ${c.employer_name}, ci-après dénommée « l’Employeur »,`,
      `Et ${emp}, né(e) le ${dateFr(c.employee.birth_date)} à ${c.employee.birth_place}, ci-après dénommé(e) « le Salarié »,`,
      `Il est conclu ${nature}`,
      'Le présent contrat est la convention par laquelle l’Employeur engage le Salarié à accomplir un travail sous sa subordination, contre une rémunération.'
    ]],
    ['Fonctions et missions', [
      `Le Salarié est engagé en qualité de ${c.position} et exercera ses fonctions sous l’autorité hiérarchique de l’Employeur.`,
      ...(c.missions.length ? ['Ses missions principales sont les suivantes :', ...c.missions.map(m => `• ${m}`)] : []),
      'Le Salarié s’engage à exécuter ses missions avec diligence, loyauté et probité. Toute modification substantielle de la qualification, de la rémunération ou du lieu de travail nécessite un avenant écrit signé des deux parties.'
    ]],
    ['Prise de fonction et période d’essai', [
      `La prise de fonction effective du Salarié intervient le ${dateFr(c.start_date)}.`,
      c.trial_days > 0
        ? `Le contrat est soumis à une période d’essai de ${c.trial_days} jours calendaires à compter de la prise de fonction. Pendant cette période, chacune des parties peut mettre fin au contrat sans motif ni indemnité, par notification écrite.`
        : 'Le contrat n’est soumis à aucune période d’essai.'
    ]],
    ['Lieu de travail', [
      `Le lieu d’exécution habituel du contrat est situé à : ${c.workplace || c.company_address || 'le siège de l’Entreprise'}. Les déplacements nécessaires aux missions sont pris en charge par l’Employeur.`
    ]],
    ['Durée du travail', [
      `La durée de travail du Salarié est fixée à ${c.hours} heures par semaine, selon les horaires en vigueur dans l’Entreprise. L’Employeur tient un registre des heures effectuées.`
    ]],
    ['Rémunération', [
      `En contrepartie de son travail, le Salarié perçoit une rémunération de ${money(c.salary)} ${c.salary_period === 'semaine' ? 'par semaine' : 'par mois'}, versée à terme échu.`,
      'Conformément au Code général des impôts de FratWorld (art. 220-4), les salaires sont payés sur le bénéfice de l’Entreprise après impôt. Toute évolution de la rémunération fait l’objet d’un avenant écrit.'
    ]],
    ['Tenue de travail', [
      'Conformément au décret n° 2026-011, l’Employeur fournit gratuitement au Salarié une tenue identifiable portant le logo ou le nom de l’Entreprise. Le Salarié la porte lorsqu’il est au contact du public ou visible depuis la voie publique.'
    ]],
    ['Obligations du Salarié', [
      'Le Salarié respecte le règlement intérieur et les consignes de l’Employeur, ainsi que ses obligations de loyauté, de discrétion et de confidentialité. Pendant la durée du contrat, il s’interdit toute activité concurrente et ne divulgue aucune information confidentielle de l’Entreprise.',
      'Il signale sans délai tout incident ou risque pour la sécurité du lieu de travail, des personnes ou des biens.'
    ]],
    ['Obligations de l’Employeur', [
      'L’Employeur fournit au Salarié le travail convenu et les moyens de l’exécuter, verse la rémunération aux échéances prévues, garantit un environnement de travail sûr et respecte la dignité du Salarié, sans discrimination ni harcèlement.'
    ]],
    ['Congés et absences', [
      'Le Salarié bénéficie de congés selon les usages de l’Entreprise. Toute absence est signalée au plus tôt à la direction et, si nécessaire, justifiée.'
    ]],
    ['Rupture du contrat', [
      T === 'CDI'
        ? 'Hors période d’essai et sauf faute grave, chacune des parties peut mettre fin au contrat par notification écrite, en respectant un préavis de 7 jours. À la fin du contrat, l’Employeur remet au Salarié un certificat de travail et un reçu pour solde de tout compte.'
        : 'Hors période d’essai, le contrat ne peut être rompu avant son terme que d’un commun accord, pour faute grave ou en cas de force majeure. À la fin du contrat, l’Employeur remet au Salarié un certificat de travail et un reçu pour solde de tout compte.'
    ]]
  ];
  if (c.clauses) out.push(['Clauses particulières', c.clauses.split(/\n+/).map(s => s.trim()).filter(Boolean)]);
  out.push(['Loi applicable et litiges', [
    'Le présent contrat est régi par le droit de l’État de FratWorld. Les parties s’engagent à rechercher une solution amiable avant tout recours ; à défaut, le litige relève des juridictions compétentes de l’État.',
    'Le présent contrat prend effet à la date de signature par les deux parties et constitue l’intégralité de leur accord.'
  ]]);
  return out;
}

// ── Mise en page PDF (A4)

export async function contractPdf(c) {
  // pdf-lib n'est chargé qu'ici : les commandes Discord répondent vite, même au démarrage à froid
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const GOLD = rgb(0.69, 0.55, 0.34), INK = rgb(0.1, 0.1, 0.12), MUTED = rgb(0.42, 0.42, 0.45), SOFT = rgb(0.98, 0.97, 0.95), LINE = rgb(0.85, 0.8, 0.72);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${CONTRACT_TYPES[c.type]} — ${c.ref}`); pdf.setAuthor(site.name); pdf.setCreator(site.name);
  const F = { r: await pdf.embedFont(StandardFonts.Helvetica), b: await pdf.embedFont(StandardFonts.HelveticaBold), i: await pdf.embedFont(StandardFonts.HelveticaOblique),
    s: await pdf.embedFont(StandardFonts.TimesRomanBold), si: await pdf.embedFont(StandardFonts.TimesRomanItalic) };
  const W = 595.28, H = 841.89, M = 56, CW = W - 2 * M;
  let page, y;
  const newPage = () => {
    page = pdf.addPage([W, H]); y = H - M;
    const wm = clean(site.name).toUpperCase(), ws = Math.min(64, (640 / F.s.widthOfTextAtSize(wm, 64)) * 64);
    page.drawText(wm, { x: W / 2 - F.s.widthOfTextAtSize(wm, ws) * 0.41, y: H / 2 - F.s.widthOfTextAtSize(wm, ws) * 0.29, size: ws, font: F.s, color: GOLD, opacity: 0.05, rotate: { type: 'degrees', angle: 35 } });
  };
  const wrap = (text, font, size, width) => {
    const words = clean(text).split(/\s+/), lines = []; let line = '';
    for (const w of words) { const t = line ? `${line} ${w}` : w; if (font.widthOfTextAtSize(t, size) > width && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    return lines;
  };
  const ensure = h => { if (y - h < M + 30) newPage(); };
  const para = (text, { font = F.r, size = 10, color = INK, indent = 0, gap = 6, lh = 1.45 } = {}) => {
    for (const l of wrap(text, font, size, CW - indent)) { ensure(size * lh); page.drawText(l, { x: M + indent, y: y - size, size, font, color }); y -= size * lh; }
    y -= gap;
  };
  newPage();
  // En-tête : entreprise · préparé par le cabinet
  page.drawRectangle({ x: M, y: y - 62, width: CW, height: 62, color: SOFT });
  page.drawRectangle({ x: M, y: y - 64, width: CW, height: 2, color: GOLD });
  page.drawText(clean(c.company), { x: M + 16, y: y - 28, size: 17, font: F.s, color: INK });
  if (c.company_address) page.drawText(clean(c.company_address), { x: M + 16, y: y - 46, size: 9, font: F.r, color: MUTED });
  const prep = 'PRÉPARÉ PAR', cab = clean(site.name);
  page.drawText(prep, { x: M + CW - 16 - F.b.widthOfTextAtSize(prep, 7.5), y: y - 24, size: 7.5, font: F.b, color: GOLD });
  page.drawText(cab, { x: M + CW - 16 - F.s.widthOfTextAtSize(cab, 11), y: y - 40, size: 11, font: F.s, color: INK });
  y -= 100;
  const kicker = 'CONTRAT DE TRAVAIL';
  page.drawText(kicker, { x: W / 2 - F.b.widthOfTextAtSize(kicker, 8) / 2, y, size: 8, font: F.b, color: GOLD }); y -= 26;
  const title = clean(CONTRACT_TYPES[c.type]);
  page.drawText(title, { x: W / 2 - F.s.widthOfTextAtSize(title, 20) / 2, y, size: 20, font: F.s, color: INK }); y -= 14;
  page.drawRectangle({ x: W / 2 - 30, y, width: 60, height: 1.5, color: GOLD }); y -= 22;
  const ref = `Référence : ${c.ref}  ·  Établi le ${dateFr(c.created_at)}`;
  page.drawText(clean(ref), { x: M + CW - F.r.widthOfTextAtSize(clean(ref), 8.5), y, size: 8.5, font: F.r, color: MUTED }); y -= 26;

  articles(c).forEach(([name, paras], k) => {
    ensure(60);
    page.drawText(clean(`ARTICLE ${k + 1} — ${name.toUpperCase()}`), { x: M, y: y - 12, size: 11.5, font: F.s, color: INK }); y -= 18;
    page.drawRectangle({ x: M, y, width: CW, height: 0.8, color: LINE }); y -= 10;
    for (const p of paras) para(p.startsWith('• ') ? p : p, { indent: p.startsWith('• ') ? 12 : 0, gap: p.startsWith('• ') ? 1 : 6 });
    y -= 6;
  });

  // Signatures
  ensure(170);
  y -= 6;
  const st = 'SIGNATURES';
  page.drawText(st, { x: W / 2 - F.s.widthOfTextAtSize(st, 12) / 2, y: y - 12, size: 12, font: F.s, color: INK }); y -= 22;
  page.drawRectangle({ x: M, y, width: CW, height: 1, color: GOLD }); y -= 20;
  const colW = (CW - 2 * 16) / 3;
  const sig = (k, label, name, sub, s, pending) => {
    const x = M + k * (colW + 16);
    page.drawText(label, { x, y, size: 7.5, font: F.b, color: GOLD });
    const by = y - 76;
    page.drawRectangle({ x, y: by, width: colW, height: 64, borderColor: LINE, borderWidth: 0.8, borderDashArray: [3, 2], color: s ? SOFT : undefined });
    if (s) {
      const n = clean(s.name), d = `Signé électroniquement le ${dateFr(s.at)}`;
      const fs = Math.min(15, ((colW - 14) / Math.max(1, F.si.widthOfTextAtSize(n, 15))) * 15);
      page.drawText(n, { x: x + colW / 2 - F.si.widthOfTextAtSize(n, fs) / 2, y: by + 36, size: fs, font: F.si, color: INK });
      wrap(d, F.r, 7.5, colW - 12).forEach((l, i) => page.drawText(l, { x: x + colW / 2 - F.r.widthOfTextAtSize(l, 7.5) / 2, y: by + 20 - i * 10, size: 7.5, font: F.r, color: MUTED }));
    } else {
      wrap(pending, F.i, 8, colW - 12).forEach((l, i) => page.drawText(l, { x: x + colW / 2 - F.i.widthOfTextAtSize(l, 8) / 2, y: by + 36 - i * 11, size: 8, font: F.i, color: MUTED }));
    }
    const nm = clean(name), sb = clean(sub);
    const ns = Math.min(11, ((colW - 4) / Math.max(1, F.s.widthOfTextAtSize(nm, 11))) * 11);
    page.drawText(nm, { x: x + colW / 2 - F.s.widthOfTextAtSize(nm, ns) / 2, y: by - 16, size: ns, font: F.s, color: INK });
    if (sb) page.drawText(sb, { x: x + colW / 2 - F.r.widthOfTextAtSize(sb, 8) / 2, y: by - 28, size: 8, font: F.r, color: MUTED });
  };
  const S = c.signatures || {};
  sig(0, "POUR L'ENTREPRISE", c.employer_name, c.employer_title || 'Employeur', S.employer, 'En attente de signature sur Discord');
  sig(1, 'LE SALARIÉ', `${c.employee.first_name} ${c.employee.last_name}`, c.position, S.employee, 'En attente de signature sur Discord');
  sig(2, 'POUR LE CABINET', S.cabinet ? S.cabinet.name : site.name, S.cabinet ? 'Avocat — validation' : 'Validation du cabinet', S.cabinet && { ...S.cabinet, name: S.cabinet.name }, 'En attente de validation par un avocat du cabinet');
  y -= 128;
  page.drawRectangle({ x: M, y, width: CW, height: 1, color: GOLD }); y -= 16;
  const foot = `${clean(site.name)}  ·  Document ${c.ref}  ·  Signatures recueillies via Discord`;
  page.drawText(foot, { x: W / 2 - F.r.widthOfTextAtSize(foot, 7.5) / 2, y, size: 7.5, font: F.r, color: MUTED });

  const pages = pdf.getPages();
  pages.forEach((p, i) => { const t = `${c.ref}  ·  Page ${i + 1} / ${pages.length}`; p.drawText(t, { x: W - M - F.r.widthOfTextAtSize(t, 7), y: 28, size: 7, font: F.r, color: MUTED }); });
  return Buffer.from(await pdf.save());
}

// ── Enregistrement
export async function createContract(data) {
  const seq = await nextId('contract_ref');
  const t = now();
  return insert('contracts', { ...data, ref: `AC-CT-${t.slice(0, 4)}-${String(seq).padStart(4, '0')}`, status: 'signature', signatures: {}, created_at: t, updated_at: t });
}
// Firebase supprime les listes et objets vides (missions, signatures) : on les remet à la lecture
const asList = v => Array.isArray(v) ? v.filter(x => x != null) : v && typeof v === 'object' ? Object.values(v) : [];
const fix = c => c && { ...c, missions: asList(c.missions), signatures: c.signatures || {}, employee: c.employee || {}, clauses: c.clauses || '' };
export const getContract = async id => fix(await get('contracts', id));
export const listContracts = async () => (await all('contracts')).map(fix).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
export async function signContract(c, party, who) {
  const signatures = { ...(c.signatures || {}), [party]: { name: who.name, discord_id: who.discord_id, at: now() } };
  const status = party === 'cabinet' ? 'valide' : (signatures.employer && signatures.employee ? 'validation' : 'signature');
  await update('contracts', c.id, { signatures, status, updated_at: now() });
  return { ...c, signatures, status };
}
export async function refuseContract(c, who) {
  await update('contracts', c.id, { status: 'refuse', refused_by: who.name, updated_at: now() });
  return { ...c, status: 'refuse', refused_by: who.name };
}

// ── Rattachement à un dossier du cabinet (client particulier, ou entreprise représentée par un citoyen)
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const CLOSED = ['cloture', 'refuse'];
export const contractSummary = c => ({ id: c.id, ref: c.ref, type: c.type, type_label: CONTRACT_TYPES[c.type], company: c.company, position: c.position,
  employee_name: `${c.employee?.first_name || ''} ${c.employee?.last_name || ''}`.trim(), status: c.status, status_label: contractStatus[c.status],
  signatures: Object.fromEntries(Object.entries(c.signatures || {}).map(([k, v]) => [k, { name: v.name, at: v.at }])), created_at: c.created_at });
export const contractsOfCase = async caseId => (await listContracts()).filter(c => c.case_id === caseId);

// Dossier indiqué dans /contrat (numéro), ou à défaut le seul dossier ouvert « entreprise » du demandeur portant ce nom d'entreprise
export async function findCaseForContract({ number, company, siteUserId, staff }) {
  const cases = await all('cases');
  if (number) {
    const k = cases.find(c => c.number === String(number).trim().toUpperCase());
    if (!k) return { err: `Dossier : aucun dossier ${String(number).trim().toUpperCase()}` };
    if (!staff && k.client_id !== siteUserId) return { err: 'Dossier : ce dossier n’est pas à votre nom sur le site' };
    if (CLOSED.includes(k.status)) return { err: `Dossier : ${k.number} est clôturé` };
    return { kase: k };
  }
  if (!siteUserId) return {};
  const mine = cases.filter(c => c.client_id === siteUserId && c.client_kind === 'entreprise' && !CLOSED.includes(c.status) && norm(c.company) === norm(company));
  return mine.length === 1 ? { kase: mine[0] } : {};
}

export async function attachToCase(contract, kase, actorId = null) {
  await update('contracts', contract.id, { case_id: kase.id, updated_at: now() });
  await addEvent(kase.id, { actor_id: actorId, type: 'contract', message: `Contrat joint au dossier : ${contract.ref} (${contract.type} — ${contract.employee.first_name} ${contract.employee.last_name}, ${contract.position})` });
  await update('cases', kase.id, { updated_at: now() });
  return { ...contract, case_id: kase.id };
}
export async function detachFromCase(contract, kase, actorId) {
  await update('contracts', contract.id, { case_id: null, updated_at: now() });
  await addEvent(kase.id, { actor_id: actorId, type: 'contract', message: `Contrat retiré du dossier : ${contract.ref}`, internal: true });
}
// Trace dans le dossier quand le contrat change d'état (signé, validé, refusé)
export async function caseNote(contract, message) {
  if (!contract.case_id) return;
  await addEvent(contract.case_id, { type: 'contract', message: `${contract.ref} : ${message}` });
  await update('cases', contract.case_id, { updated_at: now() });
}
