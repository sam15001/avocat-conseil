import { rtdb } from './store.mjs';

const env = (k, d = '') => process.env[k] ?? d;

export const DISCORD_API = () => env('DISCORD_API_BASE', 'https://discord.com/api/v10');
export const DISCORD_AUTHORIZE = () => env('DISCORD_AUTHORIZE_URL', 'https://discord.com/oauth2/authorize');
export const SITE_URL = () => env('SITE_URL', 'http://localhost:8888').replace(/\/$/, '');
export const IS_HTTPS = () => SITE_URL().startsWith('https://');

// Clés modifiables depuis Administration > Paramètres. La valeur en base prime sur l'environnement.
export const SETTING_KEYS = {
  channel_requests:     { env: 'DISCORD_CHANNEL_REQUESTS',     label: 'Salon des nouvelles demandes' },
  channel_appointments: { env: 'DISCORD_CHANNEL_APPOINTMENTS', label: 'Salon des rendez-vous' },
  channel_active:       { env: 'DISCORD_CHANNEL_ACTIVE',       label: 'Salon des dossiers en cours' },
  channel_closed:       { env: 'DISCORD_CHANNEL_CLOSED',       label: 'Salon des dossiers clôturés' },
  channel_admin:        { env: 'DISCORD_CHANNEL_ADMIN',        label: 'Salon des notifications administratives' },
  channel_welcome:      { env: 'DISCORD_CHANNEL_WELCOME',      label: 'Salon d’accueil des clients (message avec les liens du site)' },
  role_avocat:          { env: 'DISCORD_ROLE_AVOCAT',          label: 'Rôle Discord « Avocat »' },
  role_responsable:     { env: 'DISCORD_ROLE_RESPONSABLE',     label: 'Rôle Discord « Responsable juridique »' },
  role_direction:       { env: 'DISCORD_ROLE_DIRECTION',       label: 'Rôle Discord « Direction »' }
};

let cache = null;
let cacheAt = 0;

export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < 15000) return cache;
  const out = {};
  for (const [k, def] of Object.entries(SETTING_KEYS)) out[k] = env(def.env).trim();
  try {
    const saved = (await rtdb.get('tables/settings')) || {};
    for (const [key, value] of Object.entries(saved)) {
      if (key in SETTING_KEYS && String(value || '').trim()) out[key] = String(value).trim();
    }
  } catch (e) { console.error('[settings]', e.message); }
  cache = out; cacheAt = Date.now();
  return out;
}

export function invalidateSettings() { cache = null; }

const ids = v => (v || '').split(',').map(s => s.trim()).filter(Boolean);

// Rôle le plus élevé d'après la liste d'identifiants de rôles Discord d'un membre
export function roleFromDiscordRoles(memberRoles = [], settings) {
  const has = key => ids(settings[key]).some(id => memberRoles.includes(id));
  if (has('role_direction')) return 3;
  if (has('role_responsable')) return 2;
  if (has('role_avocat')) return 1;
  return 0;
}
