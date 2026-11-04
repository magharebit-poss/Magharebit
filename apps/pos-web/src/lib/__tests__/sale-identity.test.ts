import { describe, expect, it, vi } from 'vitest';
import {
  buildSaleIdentity,
  claimReceiptPrint,
  classifySaleStatus,
  completeSale,
  createSaleIdHolder,
  newClientTxId,
  postSale,
} from '../sale-identity';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DEVICE = 'a'.repeat(40);

const reply = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const saleBody = { shiftId: 's-1', lines: [{ productId: 'p-1', quantity: 1.25 }], grandTotalPiastres: 1000, paymentMethod: 'cash' };
const sentBody = (send: ReturnType<typeof vi.fn>, call: number): Record<string, unknown> =>
  JSON.parse((send.mock.calls[call]![1] as RequestInit).body as string) as Record<string, unknown>;

describe('newClientTxId', () => {
  it('is a UUID v4', () => {
    expect(newClientTxId()).toMatch(UUID_V4);
  });
});

describe('one id per sale', () => {
  it('the same id is reused for every retry of the same sale', async () => {
    const holder = createSaleIdHolder();
    const first = holder.get();
    expect(holder.get()).toBe(first);
    expect(holder.get()).toBe(first);

    const send = vi.fn()
      .mockResolvedValueOnce(reply(503, { error: 'down' }))
      .mockResolvedValueOnce(reply(200, { transactionId: 't-1', receiptNumber: 'R-000001' }));
    const getDeviceId = async () => DEVICE;
    await postSale(saleBody, await buildSaleIdentity(holder.get(), { getDeviceId }), send);
    await postSale(saleBody, await buildSaleIdentity(holder.get(), { getDeviceId }), send);

    expect(send).toHaveBeenCalledTimes(2);
    expect(sentBody(send, 0)['clientTxId']).toBe(first);
    expect(sentBody(send, 1)['clientTxId']).toBe(first);
    expect(sentBody(send, 1)['deviceId']).toBe(DEVICE);
  });

  it('a new id is created only after a successful sale or a cart reset', () => {
    let n = 0;
    const holder = createSaleIdHolder(() => `id-${++n}`);
    expect(holder.peek()).toBeNull();
    expect(holder.get()).toBe('id-1');
    expect(holder.get()).toBe('id-1');
    completeSale(holder);
    expect(holder.peek()).toBeNull();
    expect(holder.get()).toBe('id-2');
    holder.reset();
    expect(holder.get()).toBe('id-3');
  });
});

describe('replay prints once', () => {
  it('a replayed 200 is a success carrying the original sale', async () => {
    const send = vi.fn().mockResolvedValue(reply(200, { transactionId: 't-1', receiptNumber: 'R-000001', replayed: true }));
    const out = await postSale(saleBody, { clientTxId: newClientTxId() }, send);
    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') {
      expect(out.replayed).toBe(true);
      expect(out.data.receiptNumber).toBe('R-000001');
    }
  });

  it('a first success is not marked as a replay', async () => {
    const send = vi.fn().mockResolvedValue(reply(200, { transactionId: 't-1' }));
    const out = await postSale(saleBody, { clientTxId: newClientTxId() }, send);
    expect(out.kind === 'ok' && out.replayed).toBe(false);
  });

  it('the receipt prints once per sale id; a second completion (double tap or replay) prints nothing', () => {
    const holder = createSaleIdHolder();
    holder.get();
    const print = vi.fn();
    completeSale(holder, print);
    completeSale(holder, print); // the id was forgotten: nothing to print
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('claimReceiptPrint refuses a sale id that already printed', () => {
    const id = newClientTxId();
    expect(claimReceiptPrint(id)).toBe(true);
    expect(claimReceiptPrint(id)).toBe(false);
    // Even if the holder still carries that id (replay after the print), it does not print again.
    const holder = createSaleIdHolder(() => id);
    holder.get();
    const print = vi.fn();
    completeSale(holder, print);
    expect(print).not.toHaveBeenCalled();
  });
});

describe('409 is shown, never retried', () => {
  it('409 returns conflict after exactly one request', async () => {
    const send = vi.fn().mockResolvedValue(reply(409, { error: 'client_tx_id_conflict' }));
    const out = await postSale(saleBody, { clientTxId: newClientTxId() }, send);
    expect(out).toEqual({ kind: 'conflict' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('400 returns invalid (the caller shows its translated message, not the server text)', async () => {
    const send = vi.fn().mockResolvedValue(reply(400, { error: 'grand total mismatch' }));
    const out = await postSale(saleBody, { clientTxId: newClientTxId() }, send);
    expect(out).toEqual({ kind: 'invalid' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('other failures keep the status and the server code', async () => {
    const send = vi.fn().mockResolvedValue(reply(500, { error: 'Internal error' }));
    expect(await postSale(saleBody, { clientTxId: newClientTxId() }, send)).toEqual({ kind: 'failed', status: 500, error: 'Internal error' });
  });

  it('classifySaleStatus', () => {
    expect([200, 201, 409, 400, 401, 404, 500, 502].map(classifySaleStatus)).toEqual(
      ['ok', 'ok', 'conflict', 'invalid', 'failed', 'failed', 'failed', 'failed'],
    );
  });
});

describe('identity fields', () => {
  it('carries localReceiptRef for a queued offline sale', async () => {
    const id = await buildSaleIdentity('c-1', { localReceiptRef: 'LOCAL-ABCD1234', getDeviceId: async () => DEVICE });
    expect(id).toEqual({ clientTxId: 'c-1', deviceId: DEVICE, localReceiptRef: 'LOCAL-ABCD1234' });
  });

  it('omits localReceiptRef online', async () => {
    expect(await buildSaleIdentity('c-1', { getDeviceId: async () => DEVICE })).toEqual({ clientTxId: 'c-1', deviceId: DEVICE });
  });

  it('a device id the server would reject (over 128 chars) or an unreadable one is left out, the sale still goes', async () => {
    expect(await buildSaleIdentity('c-1', { getDeviceId: async () => 'x'.repeat(129) })).toEqual({ clientTxId: 'c-1' });
    expect(await buildSaleIdentity('c-1', { getDeviceId: async () => { throw new Error('no storage'); } })).toEqual({ clientTxId: 'c-1' });
  });
});
