// Held payment: what happens when a customer's money was taken (card terminal approval, Lana wallet
// debit) but the sale could not be saved. Pure logic (no React, no terminal or Lana import), so it can
// be tested and cannot reach the payment provider. Used by the card and Lana modals through
// hooks/useHeldPayment and components/HeldPaymentPanel.
//
// The payment reference and amount live only in component state. Nothing here logs them.

import { buildSaleIdentity, postSale, type Send, type SaleResponse } from './sale-identity';

export interface CardApproval {
  /** The provider's reference: the terminal approval code, or the Lana session id. What a manager needs to void it. */
  code: string;
  /** The terminal's already-masked card display; null for Lana. Never a card number. */
  maskedPan: string | null;
  amountPiastres: number;
}

/** The approved sale, frozen at approval time so every retry re-posts the exact same payload. */
export interface HeldSale {
  clientTxId: string;
  approval: CardApproval;
  body: Record<string, unknown>;
}

// ── Saving ───────────────────────────────────────────────────────────────────

export type SaveErrorKind = 'conflict' | 'invalid' | 'server' | 'network';
export interface SaveError {
  kind: SaveErrorKind;
  status?: number;
}

export type SaveResult =
  | { ok: true; replayed: boolean; data: SaleResponse }
  | { ok: false; error: SaveError };

/**
 * Post the held sale with its own clientTxId. Never throws and never touches the terminal: a replay
 * (200, replayed:true) is a normal success, 409/400 and network failures come back as an error to show.
 */
export async function saveApprovedSale(
  held: HeldSale,
  send?: Send,
  getDeviceId?: () => Promise<string>,
): Promise<SaveResult> {
  try {
    const identity = await buildSaleIdentity(held.clientTxId, getDeviceId ? { getDeviceId } : {});
    const out = await postSale(held.body, identity, send);
    switch (out.kind) {
      case 'ok':
        if (!out.data.transactionId) return { ok: false, error: { kind: 'server', status: 200 } };
        return { ok: true, replayed: out.replayed, data: out.data };
      case 'conflict':
        return { ok: false, error: { kind: 'conflict' } };
      case 'invalid':
        return { ok: false, error: { kind: 'invalid' } };
      default:
        return { ok: false, error: { kind: 'server', status: out.status } };
    }
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

/**
 * One save attempt and the state it leads to. First failure creates the held state; later failures keep
 * it; a success (including a replay) marks it saved. The payment provider is never involved.
 */
export async function attemptSave(
  held: HeldSale,
  prev: ApprovalState | null,
  send?: Send,
  getDeviceId?: () => Promise<string>,
): Promise<{ result: SaveResult; next: ApprovalState | null }> {
  const result = await saveApprovedSale(held, send, getDeviceId);
  if (result.ok) {
    return { result, next: prev ? reduceApproval(prev, { type: 'SAVED' }) : null };
  }
  return {
    result,
    next: prev
      ? reduceApproval(prev, { type: 'SAVE_FAILED', error: result.error })
      : unsavedApproval(held.approval, result.error),
  };
}

export interface SaveErrorMessages {
  conflict: string;
  invalid: string;
  /** May contain {n}, replaced with the HTTP status. */
  server: string;
  network: string;
}

export function saveErrorText(e: SaveError, m: SaveErrorMessages): string {
  switch (e.kind) {
    case 'conflict':
      return m.conflict;
    case 'invalid':
      return m.invalid;
    case 'server':
      return m.server.replace('{n}', e.status !== undefined ? String(e.status) : '?');
    default:
      return m.network;
  }
}

// ── Leaving the "approved, not saved" state ──────────────────────────────────

export type ApprovalStep = 'unsaved' | 'pin' | 'void_authorized' | 'saved' | 'closed';

export interface ApprovalState {
  step: ApprovalStep;
  /** Kept until the modal is closed after a manager-authorised void, or the sale is saved. */
  approval: CardApproval | null;
  error: SaveError | null;
}

export type ApprovalEvent =
  | { type: 'SAVE_FAILED'; error: SaveError }
  | { type: 'SAVED' }
  | { type: 'REQUEST_CLOSE' }
  | { type: 'PIN_AUTHORIZED' }
  | { type: 'PIN_CANCELLED' }
  | { type: 'DONE' };

export function unsavedApproval(approval: CardApproval, error: SaveError): ApprovalState {
  return { step: 'unsaved', approval, error };
}

/**
 * The only way out of 'unsaved' without a saved sale is request-close -> manager PIN -> authorised ->
 * done. A close request, a cancelled PIN or a stray DONE never discards the approval.
 */
export function reduceApproval(s: ApprovalState, e: ApprovalEvent): ApprovalState {
  switch (s.step) {
    case 'unsaved':
      if (e.type === 'SAVE_FAILED') return { ...s, error: e.error };
      if (e.type === 'SAVED') return { step: 'saved', approval: s.approval, error: null };
      if (e.type === 'REQUEST_CLOSE') return { ...s, step: 'pin' };
      return s;
    case 'pin':
      if (e.type === 'SAVED') return { step: 'saved', approval: s.approval, error: null };
      if (e.type === 'PIN_AUTHORIZED') return { ...s, step: 'void_authorized' };
      if (e.type === 'PIN_CANCELLED') return { ...s, step: 'unsaved' };
      return s;
    case 'void_authorized':
      if (e.type === 'DONE') return { step: 'closed', approval: null, error: null };
      return s;
    default:
      return s;
  }
}
