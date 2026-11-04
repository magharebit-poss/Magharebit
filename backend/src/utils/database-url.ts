/**
 * Where the backend connects to PostgreSQL.
 *
 * DATABASE_URL is required everywhere except a developer's own machine. The development fallback carries
 * a well-known dev password, so it must never be reachable in production or staging: any NODE_ENV other
 * than development / test (or unset) refuses to start without DATABASE_URL.
 */

const LOCAL_ENVIRONMENTS: ReadonlySet<string> = new Set(['', 'development', 'test']);

const LOCAL_DEV_URL = 'postgres://greengo:localdev@localhost:5432/greengo_dev';

/** Throws (with a message that never contains the fallback URL) when no URL may be assumed. */
export function resolveDatabaseUrl(env: Readonly<Record<string, string | undefined>>): string {
  const configured = env['DATABASE_URL'];
  if (configured !== undefined && configured.trim() !== '') return configured;

  const nodeEnv = (env['NODE_ENV'] ?? '').trim().toLowerCase();
  if (!LOCAL_ENVIRONMENTS.has(nodeEnv)) {
    throw new Error(
      `DATABASE_URL is required when NODE_ENV is "${env['NODE_ENV']}" but it is not set. ` +
      'The local development database is only assumed when NODE_ENV is development, test or unset.',
    );
  }
  return LOCAL_DEV_URL;
}
