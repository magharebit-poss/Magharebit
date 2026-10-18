import { createClient } from '@clickhouse/client';

type ClickHouseClient = ReturnType<typeof createClient>;

let _client: ClickHouseClient | null = null;

export function getClickHouseClient(): ClickHouseClient {
  if (!_client) {
    const url = process.env['CLICKHOUSE_URL'] ?? 'http://localhost:8123';
    const database = process.env['CLICKHOUSE_DB'] ?? 'magharebit_analytics';
    const username = process.env['CLICKHOUSE_USER'] ?? 'magharebit';
    const password = process.env['CLICKHOUSE_PASSWORD'] ?? 'analyticsdev';

    _client = createClient({
      url,
      database,
      username,
      password,
      // Disable keep-alive: Docker Desktop on Windows resets keep-alive
      // connections on INSERT requests, causing ECONNRESET.
      keep_alive: { enabled: false },
      compression: { request: false, response: false },
      clickhouse_settings: {
        async_insert: 0,
        wait_for_async_insert: 1,
      },
    });
  }
  return _client;
}

export async function pingClickHouse(): Promise<boolean> {
  try {
    const client = getClickHouseClient();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
