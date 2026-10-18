// card-terminal.ts — TypeScript bridge to the Tauri card_terminal Rust module.
// In browser dev mode (no Tauri), all functions return browser-friendly stubs
// so the card payment UX can be developed and tested without a physical terminal.
// In Tauri (desktop) mode, calls are forwarded to the Rust implementation via
// invoke(). The isTauri() guard means this file is safe to import in Next.js
// server-side contexts — the Tauri-specific paths never execute there.

import { invoke } from '@tauri-apps/api/core';

/** Returns true when running inside a Tauri window (desktop app). */
const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ── Request / Response types (mirror the Rust structs in card_terminal.rs) ──

export interface PaymentRequest {
  /** Total amount in integer piastres (1 MAD = 100 piastres). */
  amount_piastres: number;
  /** ISO 4217 currency code — always "MAD" for Morocco. */
  currency: string;
  /** Client-generated UUID that identifies this payment attempt. */
  transaction_ref: string;
  /** Cashier staff ID — printed on the terminal slip for audit. */
  cashier_id: string;
  /** Temporary client reference — used on the terminal printer. */
  receipt_number: string;
}

export type PaymentResponse =
  | {
      status: 'Approved';
      approval_code: string;
      card_type?: string;    // "VISA", "MC", etc.
      masked_pan?: string;   // "****1234"
      terminal_receipt?: string; // raw terminal receipt text
    }
  | { status: 'Declined'; reason_code: string; reason_text?: string }
  | { status: 'Cancelled' }
  | { status: 'Timeout' }
  | { status: 'Error'; message: string };

// ── Bridge functions ─────────────────────────────────────────────────────────

/**
 * Sends the payment amount to the physical terminal.
 * The terminal should display the amount and wait for the customer's card.
 *
 * In browser dev mode: simulates a 500 ms initiation delay.
 * In Tauri mode: forwards to card_terminal::card_initiate_payment.
 */
export async function cardInitiatePayment(request: PaymentRequest): Promise<void> {
  if (!isTauri()) {
    // Browser dev mode: simulate brief initiation latency.
    await new Promise<void>((r) => setTimeout(r, 500));
    return;
  }
  return invoke<void>('card_initiate_payment', { request });
}

/**
 * Polls (or blocks) for the terminal's payment result.
 * Returns when the customer presents their card and the terminal responds,
 * or when the terminal times out / errors.
 *
 * In browser dev mode: waits 3 seconds then returns a stub APPROVED response,
 * so the full modal flow (WAITING_CUSTOMER → APPROVED → receipt) can be tested.
 * In Tauri mode: forwards to card_terminal::card_poll_result.
 */
export async function cardPollResult(transactionRef: string): Promise<PaymentResponse> {
  if (!isTauri()) {
    // Browser dev mode: simulate the customer presenting their card.
    await new Promise<void>((r) => setTimeout(r, 3000));
    return {
      status: 'Approved',
      approval_code: 'BROWSER-DEV',
      card_type: 'VISA',
      masked_pan: '****0000',
    };
  }
  return invoke<PaymentResponse>('card_poll_result', { transactionRef });
}

/**
 * Sends a cancellation signal to the terminal while it is waiting for the card.
 * Best-effort — errors are suppressed by the caller.
 *
 * In browser dev mode: no-op (no terminal to cancel).
 * In Tauri mode: forwards to card_terminal::card_cancel.
 */
export async function cardCancel(transactionRef: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('card_cancel', { transactionRef });
}

/**
 * Checks whether the terminal is connected and responsive.
 * Useful for showing a pre-check warning on the POS screen.
 *
 * In browser dev mode: always returns false (no terminal in browser).
 * In Tauri mode: forwards to card_terminal::card_terminal_status.
 */
export async function cardTerminalStatus(): Promise<boolean> {
  if (!isTauri()) return false;
  return invoke<boolean>('card_terminal_status');
}
