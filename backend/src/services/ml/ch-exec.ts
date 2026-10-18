import { execSync } from 'node:child_process';

function chEnv() {
  return {
    container: process.env['CLICKHOUSE_CONTAINER'] ?? 'infra-clickhouse-1',
    user: process.env['CLICKHOUSE_USER'] ?? 'magharebit',
    password: process.env['CLICKHOUSE_PASSWORD'] ?? 'analyticsdev',
    db: process.env['CLICKHOUSE_DB'] ?? 'magharebit_analytics',
  };
}

/**
 * Run a SELECT query via docker exec and return parsed rows.
 * Supports ClickHouse named params: {name: Type} in the query,
 * passed as --param_name=value on the CLI.
 */
export function queryChDockerExec<T>(
  query: string,
  params?: Record<string, string | number | null>,
): T[] {
  const { container, user, password, db } = chEnv();

  const paramFlags = params
    ? Object.entries(params)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `--param_${k}=${String(v)}`)
        .join(' ')
    : '';

  // Collapse whitespace so the query passes cleanly as a single-line shell arg
  const singleLineQuery = query.replace(/\s+/g, ' ').trim();

  const cmd =
    `docker exec ${container} clickhouse-client` +
    ` --user ${user}` +
    ` --password ${password}` +
    ` --database ${db}` +
    ` --format JSONEachRow` +
    (paramFlags ? ` ${paramFlags}` : '') +
    ` --query ${JSON.stringify(singleLineQuery)}`;

  const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!output.trim()) return [];

  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

/**
 * Insert rows via docker exec (JSONEachRow piped to stdin).
 * Dates should already be serialized as "YYYY-MM-DD HH:MM:SS" strings.
 */
export function insertChRows(
  table: string,
  rows: Record<string, unknown>[],
): void {
  if (rows.length === 0) return;
  const { container, user, password, db } = chEnv();

  const jsonLines = rows
    .map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v instanceof Date) {
          out[k] = v.toISOString().replace('T', ' ').slice(0, 19);
        } else {
          out[k] = v;
        }
      }
      return JSON.stringify(out);
    })
    .join('\n');

  execSync(
    `docker exec -i ${container} clickhouse-client` +
      ` --user ${user}` +
      ` --password ${password}` +
      ` --database ${db}` +
      ` --query "INSERT INTO ${table} FORMAT JSONEachRow"`,
    { input: jsonLines, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
}
