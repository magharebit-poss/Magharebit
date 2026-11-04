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
//
// A queued sale the server can never accept (409 id conflict, 400 invalid) is REJECTED, not retried:
// it stays in the table for a manager to reconcile, is left out of the drain and the badge count,
// and is never deleted automatically.

use rusqlite::{params, Connection};
use serde::Serialize;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};

/// Longest reject reason, in characters. Also enforced by a CHECK constraint on the column.
const MAX_REASON_CHARS: usize = 200;

pub struct LocalStoreState {
    conn: Mutex<Connection>,
}

pub fn init(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    let store_dir = data_dir.join("magharebit");
    std::fs::create_dir_all(&store_dir)?;
    let db_path = store_dir.join("local_store.db");
    let conn = Connection::open(&db_path)?;
    migrate(&conn)?;
    app.manage(LocalStoreState {
        conn: Mutex::new(conn),
    });
    Ok(())
}

/// Create the tables and bring an older database up to date. Safe to run on every start: existing rows
/// are kept and stay pending (`rejected` defaults to 0).
fn migrate(conn: &Connection) -> rusqlite::Result<()> {
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
    // Databases created before these columns existed.
    add_column_if_missing(conn, "token_snapshot", "TEXT")?;
    add_column_if_missing(conn, "rejected", "INTEGER NOT NULL DEFAULT 0 CHECK (rejected IN (0, 1))")?;
    add_column_if_missing(
        conn,
        "reject_reason",
        "TEXT CHECK (reject_reason IS NULL OR length(reject_reason) <= 200)",
    )?;
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_pending_drain
         ON pending_transactions (tenant_id, rejected, created_at);",
    )?;
    Ok(())
}

/// `column` and `definition` are literals from this file, never user input.
fn add_column_if_missing(conn: &Connection, column: &str, definition: &str) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(pending_transactions)")?;
    let existing = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<rusqlite::Result<Vec<String>>>()?;
    if !existing.iter().any(|name| name == column) {
        conn.execute_batch(&format!(
            "ALTER TABLE pending_transactions ADD COLUMN {column} {definition}"
        ))?;
    }
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

/// What a manager sees for a sale the server refused. No token, no server error text.
#[derive(Serialize)]
pub struct RejectedTransaction {
    pub local_id: String,
    pub tenant_id: String,
    pub shift_id: String,
    pub payload_json: String,
    pub created_at: i64,
    pub retry_count: i64,
    pub reject_reason: Option<String>,
}

// ── Plain functions over a connection (the Tauri commands below are thin wrappers) ──────────────

fn queue(
    conn: &Connection,
    local_id: &str,
    tenant_id: &str,
    shift_id: &str,
    payload_json: &str,
    token_snapshot: &str,
    now: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO pending_transactions
         (local_id, tenant_id, shift_id, payload_json, token_snapshot, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![local_id, tenant_id, shift_id, payload_json, token_snapshot, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Pending means not synced and not rejected: this is the badge number.
fn pending_count(conn: &Connection, tenant_id: &str) -> Result<u32, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pending_transactions WHERE tenant_id = ?1 AND rejected = 0",
            params![tenant_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count as u32)
}

/// Oldest first, rejected rows excluded, so they can never fill the LIMIT and starve the drain.
fn pending_transactions(
    conn: &Connection,
    tenant_id: &str,
    limit: u32,
) -> Result<Vec<PendingTransaction>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT local_id, tenant_id, shift_id, payload_json,
                    token_snapshot, created_at, retry_count, last_error
             FROM pending_transactions
             WHERE tenant_id = ?1 AND rejected = 0
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
    rows.map(|row| row.map_err(|e| e.to_string())).collect()
}

fn mark_synced(conn: &Connection, local_id: &str, server_response: &str, now: i64) -> Result<(), String> {
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

/// Increment retry_count and record the error. A rejected row is left exactly as it is.
fn mark_failed(conn: &Connection, local_id: &str, error: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE pending_transactions
         SET retry_count = retry_count + 1, last_error = ?1
         WHERE local_id = ?2 AND rejected = 0",
        params![error, local_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// A reason is a short code, never free text: it is shown to managers and must not carry personal data.
fn validate_reason(reason: &str) -> Result<(), String> {
    let chars = reason.chars().count();
    if chars == 0 {
        return Err("reason must not be empty".to_string());
    }
    if chars > MAX_REASON_CHARS {
        return Err(format!("reason must be at most {MAX_REASON_CHARS} characters"));
    }
    let is_code_char = |c: char| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | ':');
    if !reason.chars().all(is_code_char) {
        return Err("reason must be a short code (letters, digits and _ - . : only)".to_string());
    }
    Ok(())
}

/// Stop retrying this sale for good. The row is kept for a manager; the first reason is kept too.
fn mark_rejected(conn: &Connection, local_id: &str, reason: &str) -> Result<(), String> {
    validate_reason(reason)?;
    let changed = conn
        .execute(
            "UPDATE pending_transactions
             SET rejected = 1, reject_reason = COALESCE(reject_reason, ?1)
             WHERE local_id = ?2",
            params![reason, local_id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("transaction not found".to_string());
    }
    Ok(())
}

fn list_rejected(conn: &Connection, tenant_id: &str) -> Result<Vec<RejectedTransaction>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT local_id, tenant_id, shift_id, payload_json, created_at, retry_count, reject_reason
             FROM pending_transactions
             WHERE tenant_id = ?1 AND rejected = 1
             ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![tenant_id], |row| {
            Ok(RejectedTransaction {
                local_id: row.get(0)?,
                tenant_id: row.get(1)?,
                shift_id: row.get(2)?,
                payload_json: row.get(3)?,
                created_at: row.get(4)?,
                retry_count: row.get(5)?,
                reject_reason: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.map(|row| row.map_err(|e| e.to_string())).collect()
}

// ── Tauri commands ───────────────────────────────────────────────────────────────────────────────

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
    queue(&conn, &local_id, &tenant_id, &shift_id, &payload_json, &token_snapshot, unix_ts())
}

/// Return count of pending (unsynced, not rejected) transactions for the given tenant.
/// Used by the UI queue-depth badge.
#[tauri::command]
pub async fn get_pending_count(
    app: tauri::AppHandle,
    tenant_id: String,
) -> Result<u32, String> {
    let state: State<'_, LocalStoreState> = app.state();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    pending_count(&conn, &tenant_id)
}

/// Return up to `limit` pending transactions ordered by created_at ASC.
/// Used by the sync drain. Rejected rows are never returned.
#[tauri::command]
pub async fn get_pending_transactions(
    app: tauri::AppHandle,
    tenant_id: String,
    limit: u32,
) -> Result<Vec<PendingTransaction>, String> {
    let state: State<'_, LocalStoreState> = app.state();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    pending_transactions(&conn, &tenant_id, limit)
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
    mark_synced(&conn, &local_id, &server_response, unix_ts())
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
    mark_failed(&conn, &local_id, &error)
}

/// The server refused this sale for good (409 id conflict, 400 invalid). Stop retrying it, keep it for a
/// manager, and leave it out of the drain and the badge. `reason` is a short code, not free text.
#[tauri::command]
pub async fn mark_transaction_rejected(
    app: tauri::AppHandle,
    local_id: String,
    reason: String,
) -> Result<(), String> {
    let state: State<'_, LocalStoreState> = app.state();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    mark_rejected(&conn, &local_id, &reason)
}

/// Rejected sales for the manager view, oldest first. Never includes the auth token.
#[tauri::command]
pub async fn list_rejected_transactions(
    app: tauri::AppHandle,
    tenant_id: String,
) -> Result<Vec<RejectedTransaction>, String> {
    let state: State<'_, LocalStoreState> = app.state();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    list_rejected(&conn, &tenant_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn mem() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        conn
    }

    fn add(conn: &Connection, id: &str, tenant: &str, created_at: i64) {
        queue(conn, id, tenant, "shift-1", r#"{"clientTxId":"c"}"#, "token", created_at).unwrap();
    }

    fn ids(rows: &[PendingTransaction]) -> Vec<&str> {
        rows.iter().map(|r| r.local_id.as_str()).collect()
    }

    /// A database file in the temp dir, removed when the test ends.
    struct TempDb(PathBuf);
    impl TempDb {
        fn new(tag: &str) -> Self {
            let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
            Self(std::env::temp_dir().join(format!("local_store_{tag}_{}_{nanos}.db", std::process::id())))
        }
    }
    impl Drop for TempDb {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    #[test]
    fn sixty_rejected_rows_do_not_starve_a_limit_50_drain() {
        let conn = mem();
        // 60 old rejected rows, then 3 newer pending ones.
        for i in 0..60 {
            add(&conn, &format!("rej-{i}"), "t1", i);
            mark_rejected(&conn, &format!("rej-{i}"), "client_tx_id_conflict").unwrap();
        }
        for i in 0..3 {
            add(&conn, &format!("new-{i}"), "t1", 1_000 + i);
        }
        let batch = pending_transactions(&conn, "t1", 50).unwrap();
        assert_eq!(ids(&batch), vec!["new-0", "new-1", "new-2"]);
    }

    #[test]
    fn a_full_batch_of_pending_rows_is_returned_even_with_60_rejected_ahead_of_it() {
        let conn = mem();
        for i in 0..60 {
            add(&conn, &format!("rej-{i}"), "t1", i);
            mark_rejected(&conn, &format!("rej-{i}"), "invalid_sale").unwrap();
        }
        for i in 0..55 {
            add(&conn, &format!("ok-{i:02}"), "t1", 1_000 + i);
        }
        let batch = pending_transactions(&conn, "t1", 50).unwrap();
        assert_eq!(batch.len(), 50);
        assert!(batch.iter().all(|r| r.local_id.starts_with("ok-")));
        assert_eq!(batch[0].local_id, "ok-00"); // still oldest first
    }

    #[test]
    fn the_badge_count_ignores_rejected_rows() {
        let conn = mem();
        for i in 0..5 {
            add(&conn, &format!("p-{i}"), "t1", i);
        }
        for i in 0..60 {
            add(&conn, &format!("r-{i}"), "t1", 100 + i);
            mark_rejected(&conn, &format!("r-{i}"), "invalid_sale").unwrap();
        }
        assert_eq!(pending_count(&conn, "t1").unwrap(), 5);
    }

    #[test]
    fn rejected_rows_survive_a_restart() {
        let db = TempDb::new("restart");
        {
            let conn = Connection::open(&db.0).unwrap();
            migrate(&conn).unwrap();
            add(&conn, "keep", "t1", 1);
            add(&conn, "refused", "t1", 2);
            mark_rejected(&conn, "refused", "client_tx_id_conflict").unwrap();
        } // connection dropped: the app "quits"

        let conn = Connection::open(&db.0).unwrap();
        migrate(&conn).unwrap(); // the app "starts" again
        let rejected = list_rejected(&conn, "t1").unwrap();
        assert_eq!(rejected.len(), 1);
        assert_eq!(rejected[0].local_id, "refused");
        assert_eq!(rejected[0].reject_reason.as_deref(), Some("client_tx_id_conflict"));
        assert_eq!(ids(&pending_transactions(&conn, "t1", 50).unwrap()), vec!["keep"]);
        assert_eq!(pending_count(&conn, "t1").unwrap(), 1);
    }

    #[test]
    fn migration_keeps_existing_rows_pending_and_is_idempotent() {
        // The oldest schema: no token_snapshot, no rejected, no reject_reason.
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE pending_transactions (
                local_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, shift_id TEXT NOT NULL,
                payload_json TEXT NOT NULL, created_at INTEGER NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0, last_error TEXT);
             INSERT INTO pending_transactions (local_id, tenant_id, shift_id, payload_json, created_at, retry_count)
             VALUES ('old-1', 't1', 's', '{}', 1, 0), ('old-2', 't1', 's', '{}', 2, 5);",
        )
        .unwrap();

        migrate(&conn).unwrap();
        migrate(&conn).unwrap(); // running it again changes nothing

        let batch = pending_transactions(&conn, "t1", 50).unwrap();
        assert_eq!(ids(&batch), vec!["old-1", "old-2"]); // nothing was rejected or lost
        assert_eq!(pending_count(&conn, "t1").unwrap(), 2);
        assert!(list_rejected(&conn, "t1").unwrap().is_empty());
        // And the migrated table accepts the new operations.
        mark_rejected(&conn, "old-2", "invalid_sale").unwrap();
        assert_eq!(pending_count(&conn, "t1").unwrap(), 1);
    }

    #[test]
    fn a_reason_must_be_a_short_code() {
        let conn = mem();
        add(&conn, "a", "t1", 1);
        for good in ["client_tx_id_conflict", "invalid_sale", "http.409", "a-b:c"] {
            assert!(mark_rejected(&conn, "a", good).is_ok(), "{good}");
        }
        for bad in ["", "Ahmed Benali", "ahmed@example.com", "رفض", "line\nbreak", &"x".repeat(201)] {
            assert!(mark_rejected(&conn, "a", bad).is_err(), "{bad:?}");
        }
        assert!(mark_rejected(&conn, "a", &"x".repeat(200)).is_ok());
    }

    #[test]
    fn the_database_itself_refuses_a_reason_over_200_characters() {
        let conn = mem();
        add(&conn, "a", "t1", 1);
        let too_long = "x".repeat(201);
        let result = conn.execute(
            "UPDATE pending_transactions SET rejected = 1, reject_reason = ?1 WHERE local_id = 'a'",
            params![too_long],
        );
        assert!(result.is_err());
    }

    #[test]
    fn rejecting_an_unknown_sale_is_an_error() {
        let conn = mem();
        assert!(mark_rejected(&conn, "missing", "invalid_sale").is_err());
    }

    #[test]
    fn a_rejected_sale_is_never_retried_changed_or_deleted() {
        let conn = mem();
        add(&conn, "bad", "t1", 1);
        add(&conn, "good", "t1", 2);
        mark_rejected(&conn, "bad", "client_tx_id_conflict").unwrap();

        // Later retry bookkeeping does not touch it.
        mark_failed(&conn, "bad", "HTTP 500").unwrap();
        // A second rejection keeps the first reason.
        mark_rejected(&conn, "bad", "invalid_sale").unwrap();
        // Syncing other sales does not delete it.
        mark_synced(&conn, "good", "{}", 10).unwrap();

        let rejected = list_rejected(&conn, "t1").unwrap();
        assert_eq!(rejected.len(), 1);
        assert_eq!(rejected[0].local_id, "bad");
        assert_eq!(rejected[0].retry_count, 0);
        assert_eq!(rejected[0].reject_reason.as_deref(), Some("client_tx_id_conflict"));
        assert_eq!(rejected[0].payload_json, r#"{"clientTxId":"c"}"#); // kept for reconciliation
    }

    #[test]
    fn the_manager_list_is_scoped_to_the_tenant() {
        let conn = mem();
        add(&conn, "mine", "t1", 1);
        add(&conn, "theirs", "t2", 1);
        mark_rejected(&conn, "mine", "invalid_sale").unwrap();
        mark_rejected(&conn, "theirs", "invalid_sale").unwrap();
        assert_eq!(list_rejected(&conn, "t1").unwrap().len(), 1);
        assert_eq!(pending_count(&conn, "t2").unwrap(), 0);
    }

    #[test]
    fn ordinary_failures_still_count_up_and_keep_the_row_pending() {
        let conn = mem();
        add(&conn, "a", "t1", 1);
        mark_failed(&conn, "a", "HTTP 503").unwrap();
        mark_failed(&conn, "a", "HTTP 503").unwrap();
        let row = &pending_transactions(&conn, "t1", 50).unwrap()[0];
        assert_eq!(row.retry_count, 2);
        assert_eq!(row.last_error.as_deref(), Some("HTTP 503"));
    }
}
