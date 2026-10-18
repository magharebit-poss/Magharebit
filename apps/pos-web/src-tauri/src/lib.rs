mod card_terminal;
mod local_store;
mod scale_terminal;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      local_store::init(app)?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      card_terminal::card_initiate_payment,
      card_terminal::card_poll_result,
      card_terminal::card_cancel,
      card_terminal::card_terminal_status,
      local_store::queue_transaction,
      local_store::get_pending_count,
      local_store::get_pending_transactions,
      local_store::mark_transaction_synced,
      local_store::mark_transaction_failed,
      scale_terminal::scale_connect,
      scale_terminal::scale_read_weight,
      scale_terminal::scale_disconnect,
      scale_terminal::scale_status,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
