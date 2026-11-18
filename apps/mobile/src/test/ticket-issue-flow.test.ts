import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'u' } }, error: null })),
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'jwt', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
        error: null,
      })),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
    },
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));

import {
  activateTicketByDetails,
  buildManualTicketScan,
  clearLocalActivationStores,
  generateTicketQr,
  listLocalTicketRecords,
  normalizeRedeemCodeInput,
  parseManualTicketScan,
} from '../services/ticket-activation';

const USER = '11111111-1111-4111-8111-111111111111';
const SERVER_HASH = 'ab'.repeat(32);
const params = {
  circuit: 'TicketOne',
  eventName: 'Esempio',
  eventID: 'evt-1',
  ticketNumber: '1234567890',
  date: '2026-02-11T11:54:00+01:00',
};

beforeEach(() => {
  invoke.mockReset();
  clearLocalActivationStores();
});

describe('generateTicketQr', () => {
  it('asks the server to issue the ticket and uses its random value as QR', async () => {
    invoke.mockResolvedValue({ data: { reserved: true, hash: SERVER_HASH, redeemCode: 'ABCDE-12345' }, error: null });

    const ticket = await generateTicketQr(params);

    expect(invoke).toHaveBeenCalledTimes(1);
    const [fn, options] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fn).toBe('ticket-activation');
    expect(options.body.action).toBe('issue_ticket');
    expect(options.body).not.toHaveProperty('hash');
    expect(ticket.hash).toBe(SERVER_HASH);
    expect(ticket.qrValue).toBe(SERVER_HASH);
    expect(ticket.redeemCode).toBe('ABCDE-12345');
    expect(listLocalTicketRecords().map((r) => r.hash)).toEqual([SERVER_HASH]);
  });

  it('allows re-issuing the same ticket (server returns new values, no local duplicate check)', async () => {
    invoke.mockResolvedValueOnce({ data: { reserved: true, hash: SERVER_HASH, redeemCode: 'ABCDE-12345' }, error: null });
    invoke.mockResolvedValueOnce({ data: { reserved: true, hash: 'cd'.repeat(32), redeemCode: 'VWXYZ-67890' }, error: null });
    const first = await generateTicketQr(params);
    const second = await generateTicketQr(params);
    expect(second.hash).not.toBe(first.hash);
  });

  it('surfaces the server refusal', async () => {
    invoke.mockResolvedValue({ data: { reserved: false, error: 'Impossibile emettere il ticket.' }, error: null });
    await expect(generateTicketQr(params)).rejects.toThrow('Impossibile emettere il ticket.');
    expect(listLocalTicketRecords()).toEqual([]);
  });

  it('rejects a malformed server response', async () => {
    invoke.mockResolvedValue({ data: { reserved: true, hash: 'short', redeemCode: 'ABCDE-12345' }, error: null });
    await expect(generateTicketQr(params)).rejects.toThrow();
  });

  it('rejects missing fields without calling the server', async () => {
    await expect(generateTicketQr({ ...params, ticketNumber: ' ' })).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('activateTicketByDetails', () => {
  it('sends the redeem code when supplied', async () => {
    invoke.mockResolvedValue({ data: { ok: true, eventId: 'evt-1' }, error: null });
    const result = await activateTicketByDetails('evt-1', '777', USER, 'abcde 12345');
    expect(result).toMatchObject({ ok: true, eventId: 'evt-1' });
    const body = (invoke.mock.calls[0][1] as { body: { action: string; payload: Record<string, unknown> } }).body;
    expect(body.action).toBe('activate_by_details');
    expect(body.payload).toEqual({ eventID: 'evt-1', ticketNumber: '777', redeemCode: 'ABCDE-12345' });
  });

  it('keeps the legacy call shape when no code is supplied', async () => {
    invoke.mockResolvedValue({ data: { ok: true, eventId: 'evt-2' }, error: null });
    await activateTicketByDetails('evt-2', '888', USER);
    const body = (invoke.mock.calls[0][1] as { body: { payload: Record<string, unknown> } }).body;
    expect(body.payload).toEqual({ eventID: 'evt-2', ticketNumber: '888' });
  });

  it('rejects a malformed code locally', async () => {
    const result = await activateTicketByDetails('evt-3', '999', USER, 'nope');
    expect(result.ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('returns the generic server error for a wrong code', async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: 'Ticket non trovato.' }, error: null });
    const result = await activateTicketByDetails('evt-4', '111', USER, 'ABCDE-12345');
    expect(result).toEqual({ ok: false, error: 'Ticket non trovato.' });
  });
});

describe('redeem code and manual scan helpers', () => {
  it('normalises typed codes', () => {
    expect(normalizeRedeemCodeInput('abcde12345')).toBe('ABCDE-12345');
    expect(normalizeRedeemCodeInput('abcde - 1234o')).toBe('ABCDE-12340');
    expect(normalizeRedeemCodeInput('ABCDE-1234')).toBeNull();
    expect(normalizeRedeemCodeInput('ABCDE-1234U')).toBeNull();
  });

  it('round-trips the manual scan string', () => {
    const scan = buildManualTicketScan('evt-1', 'A 12', 'ABCDE-12345');
    expect(parseManualTicketScan(scan)).toEqual({ eventId: 'evt-1', ticketNumber: 'A 12', redeemCode: 'ABCDE-12345' });
    expect(parseManualTicketScan(buildManualTicketScan('evt-1', 'A12'))).toEqual({ eventId: 'evt-1', ticketNumber: 'A12' });
    expect(parseManualTicketScan('manual-ticket:evt-1')).toBeNull();
    expect(parseManualTicketScan('other')).toBeNull();
  });
});
