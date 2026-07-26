import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import env from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const target = env.demoDbPath || path.join(__dirname, '../../data/demo-db.json');

if (fs.existsSync(target)) {
  fs.unlinkSync(target);
  console.log(`[db:demo:reset] Removed ${target}`);
} else {
  console.log(`[db:demo:reset] No file at ${target} (already clean)`);
}

const tmp = `${target}.tmp`;
if (fs.existsSync(tmp)) {
  fs.unlinkSync(tmp);
  console.log(`[db:demo:reset] Removed ${tmp}`);
}

console.log('[db:demo:reset] Restart the API to reseed the demo DB (DB_MODE=file).');
