// Charge le fichier .env (scripts locaux uniquement ; Netlify injecte ses propres variables)
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.env.ENV_FILE || '.env');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
