import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  options: '-c client_encoding=UTF8',
});

export { pool };

export interface DbClient {
  query<T>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

export async function withTenantSchema<T>(
  tenantId: string,
  callback: (client: DbClient) => Promise<T>
): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
    await client.query(`SET search_path = ${schemaName}, public`);
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  client: DbClient & { query: PoolClient['query'] },
  callback: (client: DbClient) => Promise<T>
): Promise<T> {
  await client.query('BEGIN');
  try {
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
