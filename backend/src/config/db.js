import pg from 'pg';
import env from './env.js';

const { Pool } = pg;
const useMemory = env.dbMode === 'memory' || !env.databaseUrl;

let pool = null;

if (!useMemory) {
  pool = new Pool({ connectionString: env.databaseUrl });
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

export const isMemoryMode = () => useMemory;

export default pool;
