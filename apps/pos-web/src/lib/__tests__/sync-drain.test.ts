import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../offline-queue', () => ({
  isTauri: vi.fn(() => true),
  isBackendReachable: vi.fn(async () => true),
  getPendingTransactions: vi.fn(),
  getPendingCount: vi.fn(async () => 0),
  markTransactionSynced: vi.fn(async () => undefined),
  markTransactionFailed: vi.fn(async () => undefined),
  markTransactionRejected: vi.fn(async () => undefined),
}));

import * as queue from '../offline-queue';
import { drainOnce } from '../sync-drain';

const payload = {
  clientTxId: '5b0f6d8e-2f4b-4c1a-9d3e-7a1b2c3d4e5f',
  deviceId: 'a'.repeat(40),
  localReceiptRef: 'LOCAL-ABCD1234',
  shiftId: 's-1',
};
const tx = (retry = 0) => ({
  local_id: 'q-1',
  tenant_id: 't-1',
  shift_id: 's-1',
  payload_json: JSON.stringify(payload),
  token_snapshot: 'tok',
  created_at: 1,
  retry_count: retry,
  last_error: null,
});
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('sync drain with sale identity', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(queue.isTauri).mockReturnValue(true);
    vi.mocked(queue.isBackendReachable).mockResolvedValue(true);
    vi.mocked(queue.getPendingCount).mockResolvedValue(0);
  });

  it('sends the queued payload as stored, so clientTxId and localReceiptRef reach the server', async () => {
    vi.mocked(queue.getPendingTransactions).mockResolvedValue([tx()]);
    fetchMock.mockResolvedValue(json(200, { transactionId: 't-9' }));
    await drainOnce('t-1', 'http://backend', () => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as typeof payload;
    expect(sent.clientTxId).toBe(payload.clientTxId);
    expect(sent.localReceiptRef).toBe('LOCAL-ABCD1234');
    expect(sent.deviceId).toBe(payload.deviceId);
  });

  it('a replayed 200 marks the queued sale synced', async () => {
    vi.mocked(queue.getPendingTransactions).mockResolvedValue([tx()]);
    fetchMock.mockResolvedValue(json(200, { transactionId: 't-9', replayed: true }));
    await drainOnce('t-1', 'http://backend', () => undefined);
    expect(queue.markTransactionSynced).toHaveBeenCalledTimes(1);
    expect(queue.markTransactionFailed).not.toHaveBeenCalled();
    expect(queue.markTransactionRejected).not.toHaveBeenCalled();
  });

  it('409 is sent once and the sale is rejected with a code: no retry count games, nothing deleted', async () => {
    vi.mocked(queue.getPendingTransactions).mockResolvedValue([tx(1)]);
    fetchMock.mockResolvedValue(json(409, { error: 'client_tx_id_conflict' }));
    await drainOnce('t-1', 'http://backend', () => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(queue.markTransactionRejected).toHaveBeenCalledTimes(1);
    expect(queue.markTransactionRejected).toHaveBeenCalledWith('q-1', 'client_tx_id_conflict');
    expect(queue.markTransactionFailed).not.toHaveBeenCalled(); // the old retry_count=5 hack is gone
    expect(queue.markTransactionSynced).not.toHaveBeenCalled();
  });

  it('400 is rejected too, with its own code', async () => {
    vi.mocked(queue.getPendingTransactions).mockResolvedValue([tx()]);
    fetchMock.mockResolvedValue(json(400, { error: 'Shift s-1 is not open (status: closed)' }));
    await drainOnce('t-1', 'http://backend', () => undefined);
    expect(queue.markTransactionRejected).toHaveBeenCalledWith('q-1', 'invalid_sale');
    expect(queue.markTransactionFailed).not.toHaveBeenCalled();
  });

  it('the rejection reason is a fixed code, never the server text', async () => {
    vi.mocked(queue.getPendingTransactions).mockResolvedValue([tx()]);
    fetchMock.mockResolvedValue(json(400, { error: 'customer Ahmed Benali not allowed' }));
    await drainOnce('t-1', 'http://backend', () => undefined);
    const reason = vi.mocked(queue.markTransactionRejected).mock.calls[0]![1];
    expect(reason).toMatch(/^[A-Za-z0-9_.:-]{1,200}$/);
    expect(reason).not.toContain('Ahmed');
  });

  it('a server error or an auth problem is still an ordinary retry', async () => {
    for (const status of [500, 502, 401]) {
      vi.clearAllMocks();
      vi.mocked(queue.getPendingTransactions).mockResolvedValue([tx()]);
      vi.mocked(queue.getPendingCount).mockResolvedValue(0);
      fetchMock.mockResolvedValue(json(status, { error: 'x' }));
      await drainOnce('t-1', 'http://backend', () => undefined);
      expect(queue.markTransactionFailed, `status ${status}`).toHaveBeenCalledTimes(1);
      expect(queue.markTransactionRejected, `status ${status}`).not.toHaveBeenCalled();
    }
  });

  it('if the reject call itself fails, the sale is not lost: it falls back to a normal failed mark', async () => {
    vi.mocked(queue.getPendingTransactions).mockResolvedValue([tx()]);
    fetchMock.mockResolvedValue(json(409, { error: 'client_tx_id_conflict' }));
    vi.mocked(queue.markTransactionRejected).mockRejectedValueOnce(new Error('db busy'));
    await drainOnce('t-1', 'http://backend', () => undefined);
    expect(queue.markTransactionFailed).toHaveBeenCalledTimes(1);
  });

  it('a row that already hit the retry cap is still skipped', async () => {
    vi.mocked(queue.getPendingTransactions).mockResolvedValue([tx(5)]);
    await drainOnce('t-1', 'http://backend', () => undefined);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
