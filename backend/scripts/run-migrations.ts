import 'dotenv/config'; // loads backend/.env before anything else
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigrations(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations_log (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Find and sort migration files
    const migrationsDir = join(__dirname, '..', 'migrations');
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      // Check if already applied
      const check = await client.query(
        'SELECT 1 FROM migrations_log WHERE filename = $1',
        [filename]
      );

      if (check.rows.length > 0) {
        console.log(`Skipping migration (already applied): ${filename}`);
        continue;
      }

      console.log(`Running migration: ${filename}`);
      const sql = readFileSync(join(migrationsDir, filename), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations_log (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`FAILED migration: ${filename}`);
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      }
    }

    console.log(`All migrations complete (${files.length} files processed)`);
  } finally {
    await client.end();
  }
}

runMigrations().catch((error) => {
  console.error('Migration runner failed:', error);
  process.exit(1);
});
