'use client';

// Holds a payment whose money was taken but whose sale was not saved (card approval, Lana wallet debit).
// Thin React wrapper over lib/card-approval: all decisions are made by the pure functions there.
// The reference and amount stay in this hook's state and ref only; nothing is logged or stored.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  attemptSave,
  reduceApproval,
  type ApprovalEvent,
  type ApprovalState,
  type HeldSale,
} from '../lib/card-approval';
import type { SaleResponse } from '../lib/sale-identity';

export type SaveAttempt = 'saved' | 'unsaved' | 'none';

export function useHeldPayment(onSaved: (data: SaleResponse) => void) {
  const heldRef = useRef<HeldSale | null>(null);
  const stateRef = useRef<ApprovalState | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const [state, setStateValue] = useState<ApprovalState | null>(null);
  const [saving, setSaving] = useState(false);

  const setState = useCallback((next: ApprovalState | null) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  /** Freeze the sale at the moment the money is taken. Every retry re-posts exactly this. */
  const hold = useCallback((held: HeldSale) => {
    heldRef.current = held;
    setState(null);
  }, [setState]);

  /**
   * Post the held sale with its own clientTxId. Never contacts the payment provider. A replay counts as
   * saved. On failure the held state is created or kept so the screen can show the real error.
   */
  const trySave = useCallback(async (): Promise<SaveAttempt> => {
    const held = heldRef.current;
    if (!held) return 'none';
    setSaving(true);
    const { result, next } = await attemptSave(held, stateRef.current);
    setSaving(false);
    setState(next);
    if (result.ok) {
      onSavedRef.current(result.data);
      return 'saved';
    }
    return 'unsaved';
  }, [setState]);

  const dispatch = useCallback((e: ApprovalEvent) => {
    const current = stateRef.current;
    if (current) setState(reduceApproval(current, e));
  }, [setState]);

  // The browser must not silently drop a payment that was taken but not saved.
  const holding = state !== null && (state.step === 'unsaved' || state.step === 'pin');
  useEffect(() => {
    if (!holding) return;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [holding]);

  return { state, saving, hold, trySave, dispatch };
}
