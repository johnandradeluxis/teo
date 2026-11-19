import pg from 'pg';

const { Pool } = pg;
const pool = globalThis.__teoPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: false }
});

if (process.env.NODE_ENV !== 'production') globalThis.__teoPool = pool;

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, error: 'M�todo n�o permitido.' });
  }

  try {
    const result = await pool.query(`
      SELECT
        EXISTS (SELECT 1 FROM schema_migrations WHERE version = 1) AS migrated,
        (SELECT count(*)::int FROM documents) AS documents,
        (SELECT count(*)::int FROM document_chunks) AS chunks
    `);
    return response.status(200).json({
      ok: true,
      version: '0.2.0',
      database: 'postgresql',
      migrated: result.rows[0].migrated,
      library: {
        documents: result.rows[0].documents,
        chunks: result.rows[0].chunks
      }
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'health_check_failed', code: error.code || 'internal' }));
    return response.status(503).json({ ok: false, error: 'Banco de dados temporariamente indispon�vel.' });
  }
}

