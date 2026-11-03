// Enregistre les commandes slash sur le serveur Discord du cabinet.
// Usage : npm run discord:commands (à relancer après chaque modification des commandes)
import './env.mjs';
import { COMMANDS } from '../server/interactions.mjs';

const { DISCORD_APPLICATION_ID: app, DISCORD_GUILD_ID: guild, DISCORD_BOT_TOKEN: token } = process.env;
if (!app || !guild || !token) {
  console.error('✘ DISCORD_APPLICATION_ID, DISCORD_GUILD_ID et DISCORD_BOT_TOKEN sont requis dans .env');
  process.exit(1);
}
const base = process.env.DISCORD_API_BASE || 'https://discord.com/api/v10';
const res = await fetch(`${base}/applications/${app}/guilds/${guild}/commands`, {
  method: 'PUT',
  headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(COMMANDS)
});
const body = await res.json().catch(() => ({}));
if (!res.ok) { console.error('✘ Échec', res.status, JSON.stringify(body)); process.exit(1); }
console.log(`✔ ${body.length} commandes enregistrées : ${body.map(c => '/' + c.name).join(', ')}`);
