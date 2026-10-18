// local_store.rs — Offline Transaction Queue
// ===========================================
// Stores transactions locally when the backend
// is unreachable. Drained automatically when
// connectivity returns.
// SQLite file: {app_data_dir}/magharebit/local_store.db
// Encryption: Phase 2 will add SQLCipher.
// For Phase 1, data is unencrypted — acceptable
// for dev; production requires encryption before
// merchant deployment.

use rusqlite::{params, Connection};
use serde::Serialize;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};

pub struct LocalStoreState {
    conn: Mutex<Connection>,
}

pub fn init(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    let store_dir = data_dir.join("magharebit");
    std::fs::create_dir_all(&store_dir)?;
    let db_path = store_dir.join("local_store.db");
    let conn = Connection::open(&db_path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS pending_transactions (
            local_id        TEXT PRIMARY KEY,
            tenant_id       TEXT NOT NULL,
            shift_id        TEXT NOT NULL,
            payload_json    TEXT NOT NULL,
            token_snapshot  TEXT,
            created_at      INTEGER NOT NULL,
            retry_count     INTEGER NOT NULL DEFAULT 0,
            last_error      TEXT
         );
         CREATE TABLE IF NOT EXISTS sync_log (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            local_id        TEXT NOT NULL,
            synced_at       INTEGER NOT NULL,
            server_response TEXT
         );",
    )?;
    // Migrate existing databases that were created before token_snapshot was added.
    let _ = conn.execute_batch(
        "ALTER TABLE pending_transactions ADD COLUMN token_snapshot TEXT",
    );
    app.manage(LocalStoreState {
        conn: Mutex::new(conn),
    });
    Ok(())
}

fn unix_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[derive(Serialize)]
pub struct PendingTransaction {
    pub local_id: String,
    pub tenant_id: String,
    pub shift_id: String,
    pub payload_json: String,
    pub token_snapshot: Option<String>,
    pub created_at: i64,
    pub retry_count: i64,
    pub last_error: Option<String>,
}

/// Insert a transaction into the local queue for later sync.
/// Returns Ok(()) immediately — never blocks the UI.
#[tauri::command]
pub async fn queue_transaction(
    app: tauri::AppHandle,
    local_id: String,
    tenant_id: String,
    shift_id: String,
    payload_json: String,
    token_snapshot: String,
) -> Result<(), String> {
    let state: State<'_, LocalStoreState> = app.state();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = unix_ts();
    conn.execute(
        "INSERT INTO pending_transactions
         (local_id, tenant_id, shift_id, payload_json, token_snapshot, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![local_id, tenant_id, shift_id, payload_json, token_snapshot, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Return count of pending (unsynced) transactions for the given tenant.
/// Used by the UI queue-depth badge.
#[tauri::command]
pub async fn get_pending_count(
    app: tauri::AppHandle,
    tenant_id: String,
) -> Result<u32, String> {
    let state: State<'_, LocalStoreState> = app.state();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pending_transactions WHERE tenant_id = ?1",
            params![tenant_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count as u32)
}

/// Return up to `limit` pending transactions ordered by created_at ASC.
/// Used by the sync drain.
#[tauri::command]
pub async fn get_pending_transactions(
    app: tauri::AppHandle,
    tenant_id: String,
    limit: u32,
) -> Result<Vec<PendingTransaction>, String> {
    let state: State<'_, LocalStoreState> = app.state();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT local_id, tenant_id, shift_id, payload_json,
                    token_snapshot, created_at, retry_count, last_error
             FROM pending_transactions
             WHERE tenant_id = ?1
             ORDER BY created_at ASC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![tenant_id, limit as i64], |row| {
            Ok(PendingTransaction {
                local_id: row.get(0)?,
                tenant_id: row.get(1)?,
                shift_id: row.get(2)?,
                payload_json: row.get(3)?,
                token_snapshot: row.get(4)?,
                created_at: row.get(5)?,
                retry_count: row.get(6)?,
                last_error: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

/// Delete from pending_transactions and write to sync_log.
#[tauri::command]
pub async fn mark_transaction_synced(
    app: tauri::AppHandle,
    local_id: String,
    server_response: String,
) -> Result<(), String> {
    let state: State<'_, LocalStoreState> = app.state();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = unix_ts();
    conn.execute(
        "DELETE FROM pending_transactions WHERE local_id = ?1",
        params![local_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO sync_log (local_id, synced_at, server_response) VALUES (?1, ?2, ?3)",
        params![local_id, now, server_response],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Increment retry_count and record the error.
/// Does NOT delete — the drain will retry on the next cycle.
#[tauri::command]
pub async fn mark_transaction_failed(
    app: tauri::AppHandle,
    local_id: String,
    error: String,
) -> Result<(), String> {
    let state: State<'_, LocalStoreState> = app.state();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE pending_transactions
         SET retry_count = retry_count + 1, last_error = ?1
         WHERE local_id = ?2",
        params![error, local_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
