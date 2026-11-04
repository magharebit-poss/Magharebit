import { beforeEach, describe, expect, it, vi } from 'vitest';

// The terminal must never be reached from the save path. If card-approval ever imports it, these spies see it.
vi.mock('../card-terminal', () => ({
  cardInitiatePayment: vi.fn(),
  cardPollResult: vi.fn(),
  cardCancel: vi.fn(),
  cardTerminalStatus: vi.fn(),
}));

import * as terminal from '../card-terminal';
import {
  attemptSave,
  reduceApproval,
  saveApprovedSale,
  saveErrorText,
  unsavedApproval,
  type ApprovalState,
  type HeldSale,
} from '../card-approval';
import { completeSale, createSaleIdHolder } from '../sale-identity';
import { TRANSLATIONS } from '../i18n';

const CLIENT_TX_ID = '5b0f6d8e-2f4b-4c1a-9d3e-7a1b2c3d4e5f';
const DEVICE = async () => 'd'.repeat(40);

const held = (): HeldSale => ({
  clientTxId: CLIENT_TX_ID,
  approval: { code: 'APPR-12345', maskedPan: '****1111', amountPiastres: 4250 },
  body: {
    shiftId: 's-1',
    soldAt: '2026-11-04T12:00:00.000Z',
    lines: [{ productId: 'p-1', quantity: 1, lineTotalPiastres: 4250 }],
    paymentMethod: 'card',
    grandTotalPiastres: 4250,
    approvalCode: 'APPR-12345',
    maskedPan: '****1111',
  },
});

const reply = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const bodyOf = (send: ReturnType<typeof vi.fn>, call: number): Record<string, unknown> =>
  JSON.parse((send.mock.calls[call]![1] as RequestInit).body as string) as Record<string, unknown>;

beforeEach(() => vi.clearAllMocks());

describe('approval is kept after a failed post', () => {
  it.each([
    ['network failure', () => { throw new TypeError('Failed to fetch'); }, { kind: 'network' }],
    ['409 conflict', () => reply(409, { error: 'client_tx_id_conflict' }), { kind: 'conflict' }],
    ['400 invalid', () => reply(400, { error: 'grand total mismatch' }), { kind: 'invalid' }],
    ['500 server', () => reply(500, { error: 'Internal error' }), { kind: 'server', status: 500 }],
    ['200 without a transaction id', () => reply(200, {}), { kind: 'server', status: 200 }],
  ])('%s -> the result is an error and the approval stays on hold', async (_n, respond, expected) => {
    const send = vi.fn().mockImplementation(async () => respond());
    const result = await saveApprovedSale(held(), send, DEVICE);
    expect(result).toEqual({ ok: false, error: expected });

    if (result.ok) throw new Error('expected a failed save');
    const state = unsavedApproval(held().approval, result.error);
    expect(state.step).toBe('unsaved');
    expect(state.approval).toEqual({ code: 'APPR-12345', maskedPan: '****1111', amountPiastres: 4250 });
    expect(state.error).toEqual(expected);
  });

  it('the approval survives further failures, a close request and a cancelled PIN', () => {
    let s: ApprovalState = unsavedApproval(held().approval, { kind: 'network' });
    s = reduceApproval(s, { type: 'SAVE_FAILED', error: { kind: 'server', status: 502 } });
    s = reduceApproval(s, { type: 'REQUEST_CLOSE' });
    s = reduceApproval(s, { type: 'PIN_CANCELLED' });
    expect(s.step).toBe('unsaved');
    expect(s.approval?.code).toBe('APPR-12345');
    expect(s.error).toEqual({ kind: 'server', status: 502 });
  });
});

describe('retry saving', () => {
  it('re-posts the same clientTxId and the same payload, and never contacts the terminal', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce(reply(503, { error: 'down' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(reply(200, { transactionId: 't-1', receiptNumber: 'R-000007' }));
    const h = held();
    const r1 = await saveApprovedSale(h, send, DEVICE);
    const r2 = await saveApprovedSale(h, send, DEVICE);
    const r3 = await saveApprovedSale(h, send, DEVICE);

    expect([r1.ok, r2.ok, r3.ok]).toEqual([false, false, true]);
    expect(send).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 3; i++) expect(bodyOf(send, i)['clientTxId']).toBe(CLIENT_TX_ID);
    // Same payload every time, soldAt included: the body was frozen at approval.
    const strip = (b: Record<string, unknown>) => { const { clientTxId: _c, deviceId: _d, ...rest } = b; return rest; };
    expect(strip(bodyOf(send, 1))).toEqual(strip(bodyOf(send, 0)));
    expect(strip(bodyOf(send, 2))).toEqual(h.body);

    expect(terminal.cardInitiatePayment).not.toHaveBeenCalled();
    expect(terminal.cardPollResult).not.toHaveBeenCalled();
    expect(terminal.cardCancel).not.toHaveBeenCalled();
  });
});

describe('cancel and void needs a manager PIN', () => {
  const start = (): ApprovalState => unsavedApproval(held().approval, { kind: 'network' });

  it('a close request only asks for the PIN: nothing is discarded', () => {
    const s = reduceApproval(start(), { type: 'REQUEST_CLOSE' });
    expect(s.step).toBe('pin');
    expect(s.approval).not.toBeNull();
  });

  it('DONE cannot close without the PIN, from either step', () => {
    const unsaved = reduceApproval(start(), { type: 'DONE' });
    expect(unsaved.step).toBe('unsaved');
    const pin = reduceApproval(reduceApproval(start(), { type: 'REQUEST_CLOSE' }), { type: 'DONE' });
    expect(pin.step).toBe('pin');
    expect(pin.approval).not.toBeNull();
  });

  it('an authorisation that was never requested is ignored', () => {
    expect(reduceApproval(start(), { type: 'PIN_AUTHORIZED' }).step).toBe('unsaved');
  });

  it('only PIN authorised then DONE closes; the reference is still available between the two', () => {
    let s = reduceApproval(start(), { type: 'REQUEST_CLOSE' });
    s = reduceApproval(s, { type: 'PIN_AUTHORIZED' });
    expect(s.step).toBe('void_authorized');
    expect(s.approval?.code).toBe('APPR-12345'); // shown so the approval can be voided at the terminal
    s = reduceApproval(s, { type: 'DONE' });
    expect(s.step).toBe('closed');
    expect(s.approval).toBeNull();
  });
});

describe('a replay counts as saved, once', () => {
  it('a lost first response followed by a retry stores one sale, and the receipt prints once', async () => {
    // Fake server: stores by clientTxId, answers a repeat with the original and replayed:true.
    const stored = new Map<string, { transactionId: string; receiptNumber: string }>();
    let calls = 0;
    const send = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      calls++;
      const id = (JSON.parse(init.body as string) as { clientTxId: string }).clientTxId;
      const known = stored.get(id);
      if (known) return reply(200, { ...known, replayed: true });
      const sale = { transactionId: 't-1', receiptNumber: 'R-000001' };
      stored.set(id, sale);
      if (calls === 1) throw new TypeError('connection dropped after the server committed');
      return reply(200, sale);
    });

    const h = held();
    const first = await saveApprovedSale(h, send, DEVICE);
    expect(first.ok).toBe(false); // the cashier saw a failure, but the sale was stored

    const second = await saveApprovedSale(h, send, DEVICE);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.replayed).toBe(true);
      expect(second.data.receiptNumber).toBe('R-000001');
    }
    expect(stored.size).toBe(1);

    // Finishing the sale prints once even if the completion fires twice.
    const holder = createSaleIdHolder(() => h.clientTxId);
    holder.get();
    const print = vi.fn();
    completeSale(holder, print);
    completeSale(holder, print);
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe('attemptSave (the state the screen shows after each attempt)', () => {
  it('first failure creates the held state, later failures keep it, a replay marks it saved', async () => {
    const h = held();
    const send = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(reply(500, { error: 'Internal error' }))
      .mockResolvedValueOnce(reply(200, { transactionId: 't-1', replayed: true }));

    const a1 = await attemptSave(h, null, send, DEVICE);
    expect(a1.next?.step).toBe('unsaved');
    expect(a1.next?.error).toEqual({ kind: 'network' });

    const a2 = await attemptSave(h, a1.next, send, DEVICE);
    expect(a2.next?.step).toBe('unsaved');
    expect(a2.next?.error).toEqual({ kind: 'server', status: 500 });
    expect(a2.next?.approval?.code).toBe('APPR-12345');

    const a3 = await attemptSave(h, a2.next, send, DEVICE);
    expect(a3.result.ok && a3.result.replayed).toBe(true);
    expect(a3.next?.step).toBe('saved');
  });

  it('a first-try success needs no held state', async () => {
    const send = vi.fn().mockResolvedValue(reply(200, { transactionId: 't-1' }));
    expect((await attemptSave(held(), null, send, DEVICE)).next).toBeNull();
  });

  it('a save that completes while the PIN prompt is open is kept as saved, not lost', () => {
    const s = reduceApproval(unsavedApproval(held().approval, { kind: 'network' }), { type: 'REQUEST_CLOSE' });
    expect(reduceApproval(s, { type: 'SAVED' }).step).toBe('saved');
  });

  it('once a manager has authorised the void, a late save result cannot undo it', () => {
    let s = reduceApproval(unsavedApproval(held().approval, { kind: 'network' }), { type: 'REQUEST_CLOSE' });
    s = reduceApproval(s, { type: 'PIN_AUTHORIZED' });
    expect(reduceApproval(s, { type: 'SAVED' }).step).toBe('void_authorized');
  });
});

describe('Lana payment held (wallet debited, sale not saved)', () => {
  const lana = (): HeldSale => ({
    clientTxId: CLIENT_TX_ID,
    approval: { code: 'LANA-SESSION-9', maskedPan: null, amountPiastres: 1800 },
    body: {
      shiftId: 's-1',
      soldAt: '2026-11-04T12:00:00.000Z',
      lines: [{ productId: 'p-1', quantity: 2, lineTotalPiastres: 1800 }],
      paymentMethod: 'lana',
      grandTotalPiastres: 1800,
    },
  });

  it('retry re-posts the same clientTxId and payload, and only ever calls the sale endpoint (never Lana)', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce(reply(503, { error: 'down' }))
      .mockResolvedValueOnce(reply(200, { transactionId: 't-2', receiptNumber: 'R-000002' }));
    const h = lana();
    const r1 = await saveApprovedSale(h, send, DEVICE);
    const r2 = await saveApprovedSale(h, send, DEVICE);
    expect([r1.ok, r2.ok]).toEqual([false, true]);

    for (const call of send.mock.calls as Array<[string, RequestInit]>) expect(call[0]).toBe('/api/transactions');
    expect(bodyOf(send, 0)['clientTxId']).toBe(CLIENT_TX_ID);
    expect(bodyOf(send, 1)['clientTxId']).toBe(CLIENT_TX_ID);
    expect(bodyOf(send, 1)['paymentMethod']).toBe('lana');
    expect(bodyOf(send, 1)['grandTotalPiastres']).toBe(1800);
    expect(bodyOf(send, 1)['approvalCode']).toBeUndefined(); // a Lana sale carries no card fields
    expect(bodyOf(send, 1)['maskedPan']).toBeUndefined();
  });

  it('a 409 or 400 keeps the payment on hold with the right error', async () => {
    for (const [status, kind] of [[409, 'conflict'], [400, 'invalid']] as const) {
      const send = vi.fn().mockResolvedValue(reply(status, { error: 'x' }));
      const { next } = await attemptSave(lana(), null, send, DEVICE);
      expect(next?.step).toBe('unsaved');
      expect(next?.error).toEqual({ kind });
      expect(next?.approval?.code).toBe('LANA-SESSION-9');
    }
  });

  it('no Lana message, in any language, tells the cashier to clear the cart or start a new sale', () => {
    const forbidden = /clear the cart|empty the cart|start a new sale|videz le panier|vider le panier|nouvelle vente|تفريغ السلة|ابدأ عملية جديدة/i;
    const keys = [
      'unsavedTitle', 'unsavedBody', 'unsavedCloseWarning', 'retrySaving', 'cancelAndVoid', 'voidTitle',
      'voidBody', 'saveErrorConflict', 'saveErrorInvalid', 'saveErrorServer', 'saveErrorNetwork',
    ] as const;
    for (const lang of ['ar', 'fr', 'en'] as const) {
      for (const k of keys) {
        const text = TRANSLATIONS[lang].lana[k];
        expect(text, `${lang}.lana.${k} should exist`).toBeTruthy();
        expect(forbidden.test(text), `${lang}.lana.${k}: "${text}"`).toBe(false);
      }
    }
  });

  it('cancel and void need the manager PIN and show the session reference afterwards', () => {
    let s = unsavedApproval(lana().approval, { kind: 'network' });
    s = reduceApproval(s, { type: 'DONE' });
    expect(s.step).toBe('unsaved'); // cannot leave without the PIN
    s = reduceApproval(s, { type: 'REQUEST_CLOSE' });
    expect(s.step).toBe('pin');
    s = reduceApproval(s, { type: 'PIN_AUTHORIZED' });
    expect(s.step).toBe('void_authorized');
    expect(s.approval?.code).toBe('LANA-SESSION-9');
  });
});

describe('save error text', () => {
  const m = { conflict: 'C', invalid: 'I', server: 'Server HTTP {n}', network: 'N' };
  it('maps every kind to its message and fills in the status', () => {
    expect(saveErrorText({ kind: 'conflict' }, m)).toBe('C');
    expect(saveErrorText({ kind: 'invalid' }, m)).toBe('I');
    expect(saveErrorText({ kind: 'network' }, m)).toBe('N');
    expect(saveErrorText({ kind: 'server', status: 502 }, m)).toBe('Server HTTP 502');
  });
});
