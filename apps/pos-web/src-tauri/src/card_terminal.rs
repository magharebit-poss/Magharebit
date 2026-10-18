// card_terminal.rs — CMI Terminal Integration
// ============================================
// This module defines the interface between the Magharebit POS and the
// physical card payment terminal (CMI-certified TPE: Verifone VX805/VX820
// or equivalent).
//
// CURRENT STATE: ALL COMMANDS ARE STUBS.
// The interface is final; only the implementations change when the CMI
// integration document is received.
//
// Integration boundary:
//   - POS (Next.js) calls these Tauri commands via card-terminal.ts
//   - This module translates to/from the CMI protocol
//   - Physical terminal: Verifone VX805/VX820 connected via RS-232/USB or TCP/IP
//   - Protocol: CMI semi-integrated specification
//     (document pending — do NOT implement until official CMI spec received)
//
// When the CMI spec arrives, ONLY this file changes. No other file in the
// project needs to be modified for the protocol implementation.

use serde::{Deserialize, Serialize};

// ── Request / Response types ─────────────────────────────────────────────────

/// Payment initiation request from the POS to the terminal.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaymentRequest {
    /// Total amount in integer piastres (1 MAD = 100 piastres).
    pub amount_piastres: u64,
    /// ISO 4217 currency code — "MAD" for Morocco.
    pub currency: String,
    /// Client-generated UUID identifying this payment attempt.
    pub transaction_ref: String,
    /// Cashier staff ID — printed on the terminal slip for audit.
    pub cashier_id: String,
    /// Client receipt reference displayed on the terminal printer.
    pub receipt_number: String,
}

/// Terminal payment result, tagged by status for serde discriminated union.
/// The TypeScript PaymentResponse type in card-terminal.ts mirrors this exactly.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "status")]
pub enum PaymentResponse {
    Approved {
        approval_code: String,
        card_type: Option<String>,       // "VISA", "MC", etc.
        masked_pan: Option<String>,      // "****1234"
        terminal_receipt: Option<String>, // raw receipt text from terminal
    },
    Declined {
        reason_code: String,
        reason_text: Option<String>,
    },
    Cancelled,
    Timeout,
    Error {
        message: String,
    },
}

// ── Tauri commands (all stubs) ───────────────────────────────────────────────

/// Sends the payment amount to the physical terminal and waits for
/// acknowledgement that the terminal is ready to accept the card.
///
/// STUB: returns Ok(()) immediately, simulating instant terminal acknowledgement.
///
/// TODO (CMI spec required): Open the configured serial/USB/TCP port, send the
/// CMI INITIATE_PAYMENT command with the amount and transaction_ref, wait for
/// the terminal ACK. Raise an error if the port is unavailable or times out.
#[tauri::command]
pub async fn card_initiate_payment(request: PaymentRequest) -> Result<(), String> {
    // STUB — CMI protocol implementation goes here.
    // The request fields are validated and ready to send to the terminal.
    let _ = request; // suppress unused warning until implemented
    Ok(())
}

/// Polls (or blocks) for the terminal payment result after initiation.
/// Returns when the customer presents their card and the terminal responds,
/// or when the terminal times out.
///
/// STUB: returns a simulated APPROVED response immediately.
/// The approval_code "STUB-001" identifies stub responses in logs.
///
/// TODO (CMI spec required): Read from the CMI response channel (serial/TCP)
/// until a terminal result frame arrives or the configured timeout elapses.
/// Parse the CMI response frame into the appropriate PaymentResponse variant.
#[tauri::command]
pub async fn card_poll_result(transaction_ref: String) -> Result<PaymentResponse, String> {
    // STUB — CMI protocol implementation goes here.
    let _ = transaction_ref; // suppress unused warning until implemented
    Ok(PaymentResponse::Approved {
        approval_code: "STUB-001".to_string(),
        card_type: Some("VISA".to_string()),
        masked_pan: Some("****0000".to_string()),
        terminal_receipt: None,
    })
}

/// Sends a cancellation to the terminal while it is waiting for the customer's
/// card (WAITING_CUSTOMER state). Has no effect after the card is presented.
///
/// STUB: returns Ok(()) immediately.
///
/// TODO (CMI spec required): Send the CMI CANCEL command on the open port.
/// The terminal should abort the payment request and return to idle.
#[tauri::command]
pub async fn card_cancel(transaction_ref: String) -> Result<(), String> {
    // STUB — CMI protocol implementation goes here.
    let _ = transaction_ref; // suppress unused warning until implemented
    Ok(())
}

/// Returns whether the terminal is connected and responsive.
/// Used for optional pre-flight checks on the POS screen.
///
/// STUB: always returns false so that in browser dev mode (where Tauri commands
/// are unavailable) the isTauri() guard in card-terminal.ts prevents this from
/// being called, and in Tauri mode with no terminal connected the UI correctly
/// shows "terminal unavailable" rather than silently hanging.
///
/// TODO (CMI spec required): Ping the configured terminal port (e.g. send a
/// STATUS command) and return true if the terminal responds within 2 seconds.
#[tauri::command]
pub async fn card_terminal_status() -> Result<bool, String> {
    // STUB — CMI protocol implementation goes here.
    Ok(false)
}
