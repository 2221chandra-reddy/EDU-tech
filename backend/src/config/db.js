import pg from 'pg';
import env from './env.js';

const { Pool } = pg;

/** In-RAM or file-backed demo store (not PostgreSQL). */
export const isDemoStoreMode = () => env.dbMode === 'memory' || env.dbMode === 'file';

const useMemory =
  isDemoStoreMode() || (env.dbMode !== 'postgres' && !env.databaseUrl);

let pool = null;

if (!useMemory) {
  const url = env.databaseUrl;
  const needsSsl = /neon\.tech|sslmode=require|amazonaws\.com/i.test(url);
  pool = new Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: /neon\.tech/i.test(url) ? 5 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000,
  });
  pool.on('error', (err) => {
    console.error('[db] Unexpected PostgreSQL error', err.message);
  });
}

export const query = async (text, params) => {
  if (useMemory) {
    const { memoryQuery } = await import('../db/memory.js');
    return memoryQuery(text, params);
  }
  return pool.query(text, params);
};

/** True for memory and file demo modes (and legacy fallback when no DATABASE_URL). */
export const isMemoryMode = () => useMemory;

export const isFileDbMode = () => env.dbMode === 'file';

export default pool;
