import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import env from '../config/env.js';
import pool, { isMemoryMode } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function init() {
  if (isMemoryMode()) {
    throw new Error('db:init requires DB_MODE=postgres and DATABASE_URL (not memory)');
  }
  if (!pool) {
    throw new Error('PostgreSQL pool not available — check DATABASE_URL');
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log(`[db:init] Schema applied to ${env.databaseUrl.replace(/:[^:@/]+@/, ':****@')}`);
  await pool.end();
}

init().catch((err) => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
