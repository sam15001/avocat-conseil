// Icônes au trait (24 × 24), utilisées par le build et par le navigateur.
const svg = (d, w = 1.5) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>'),
  scales: svg('<path d="M12 3v17M7 20h10M5 7h14M12 5.5V7"/><path d="M5 7 2.5 13h5zM19 7l-2.5 6h5z"/><path d="M2.5 13a2.5 2.5 0 0 0 5 0M16.5 13a2.5 2.5 0 0 0 5 0"/>'),
  briefcase: svg('<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M9 7V5h6v2M3 12.5h18M11 12h2v2h-2z"/>'),
  people: svg('<circle cx="12" cy="8" r="3"/><circle cx="5.5" cy="10" r="2.2"/><circle cx="18.5" cy="10" r="2.2"/><path d="M6.5 20v-1.5a5.5 5.5 0 0 1 11 0V20M1.5 19v-1a4 4 0 0 1 4.3-4M22.5 19v-1a4 4 0 0 0-4.3-4"/>'),
  house: svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  car: svg('<path d="M4 16v-3.5L6 8h12l2 4.5V16"/><path d="M3 16h18v2.5H3z"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/><path d="M5 18.5V20M19 18.5V20"/>'),
  handshake: svg('<path d="m2 11 4-4 4 2 3-2 5 1 4 3"/><path d="M6 7v6l4.5 4.5a1.5 1.5 0 0 0 2.1 0l5.4-5.4"/><path d="m10 12 2 2M12 10.5l2.5 2.5M14 9.5l2.5 2.5"/>'),
  home: svg('<path d="M3 11.5 12 4l9 7.5V20h-6v-5H9v5H3z"/>'),
  folder: svg('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4M8 13h2M14 13h2M8 16.5h2"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/>'),
  logout: svg('<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10"/>'),
  dashboard: svg('<rect x="3.5" y="3.5" width="7" height="8" rx="1"/><rect x="13.5" y="3.5" width="7" height="5" rx="1"/><rect x="3.5" y="14.5" width="7" height="6" rx="1"/><rect x="13.5" y="11.5" width="7" height="9" rx="1"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 4 6"/>'),
  news: svg('<rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M7 8h10M7 12h10M7 16h6"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  play: svg('<path d="M8 5.5v13l10-6.5z"/>'),
  check: svg('<circle cx="12" cy="12" r="8.5"/><path d="m8 12.2 2.7 2.6L16 9.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 1.8),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 1.7),
  inbox: svg('<path d="M3.5 13.5 6 5h12l2.5 8.5V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5"/>'),
  message: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
  phone: svg('<path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>'),
  history: svg('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4v4h4M12 8v4l3 2"/>'),
  plusCircle: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>'),
  camera: svg('<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>')
};

export const DOMAIN_ICON = { penal: 'scales', affaires: 'briefcase', civil: 'people', immobilier: 'house', 'administratif-routier': 'car', conseil: 'handshake' };

// Blason : balance de la justice dans une couronne de lauriers
export function crest(cls = 'crest') {
  const leaves = [];
  const d2r = Math.PI / 180;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const deg = side < 0 ? 252 - i * 14 : -72 + i * 14; // de bas en haut
      const a = deg * d2r, r = 25;
      const cx = 32 + Math.cos(a) * r, cy = 35 - Math.sin(a) * r;
      const tan = Math.atan2(-Math.cos(a), -Math.sin(a)) / d2r;
      const rot = tan + (side < 0 ? 180 - 40 : 40);
      leaves.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="4.3" ry="1.6" transform="rotate(${rot.toFixed(0)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`);
    }
  }
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M15 53a25 25 0 0 1-8-30M49 53a25 25 0 0 0 8-30" fill="none" stroke="currentColor" stroke-width="1" opacity=".7"/><g fill="currentColor" opacity=".9">${leaves.join('')}</g>
    <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M32 15v31M18 22h28M32 18.5V22"/><circle cx="32" cy="13.2" r="1.7"/>
      <path d="M19 22l-5 10.5h10zM45 22l-5 10.5h10z"/>
      <path d="M13.5 32.5a5.5 5.5 0 0 0 11 0M39.5 32.5a5.5 5.5 0 0 0 11 0"/>
      <path d="M25 49h14M27.5 46h9"/>
    </g></svg>`;
}
