import { beforeEach, expect, mock, test } from 'bun:test';

// Fake server: a network switch and an RPC that records what landed.
let networkUp = true;
const landed = new Map<string, number>();
const finalized = new Set<string>();

mock.module('./supabase', () => ({
  supabase: {
    rpc: async (_fn: string, args: { p_registration_id: string; p_final_score: number }) => {
      if (!networkUp) return { data: null, error: { message: 'TypeError: Failed to fetch' } };
      if (finalized.has(args.p_registration_id)) return { data: { error: 'finalized' }, error: null };
      landed.set(args.p_registration_id, args.p_final_score);
      return { data: { status: 'created' }, error: null };
    },
  },
}));

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
  fetch: async () => {
    if (!networkUp) throw new TypeError('Failed to fetch');
    return new Response(null);
  },
});
let signedIn = true;
Object.assign(globalThis, { window: globalThis });
Object.defineProperty(globalThis, 'Clerk', { get: () => (signedIn ? { session: { getToken: async () => 'token' } } : undefined), configurable: true });
Object.defineProperty(globalThis.navigator, 'onLine', { get: () => networkUp, configurable: true });

const { bindOutbox, flushOutbox, submitScore } = await import('./scoreOutbox');
const score = (id: string, finalScore: number) => ({
  registrationId: id, participantName: id, finalScore, remarks: '', juryName: 'Jury',
});

beforeEach(() => {
  networkUp = true;
  signedIn = true;
  landed.clear();
  finalized.clear();
  store.clear();
  bindOutbox('jury_1');
});

test('online submission syncs immediately', async () => {
  expect(await submitScore(score('a', 88))).toEqual({ status: 'synced' });
  expect(landed.get('a')).toBe(88);
});

test('offline submissions are kept on the device and sync on recovery', async () => {
  networkUp = false;
  expect(await submitScore(score('a', 80))).toEqual({ status: 'queued' });
  expect(await submitScore(score('b', 70))).toEqual({ status: 'queued' });
  expect(await submitScore(score('a', 81.5))).toEqual({ status: 'queued' }); // latest edit wins
  expect(landed.size).toBe(0);
  expect(Object.keys(JSON.parse(store.get('ml-scoring-outbox:jury_1')!))).toEqual(['a', 'b']);

  // A reload while offline keeps the queue.
  bindOutbox('jury_1');
  networkUp = true;
  await flushOutbox();
  expect(Object.fromEntries(landed)).toEqual({ a: 81.5, b: 70 });
  expect(JSON.parse(store.get('ml-scoring-outbox:jury_1')!)).toEqual({});
});

test('a server rejection is reported, not retried forever', async () => {
  finalized.add('a');
  expect(await submitScore(score('a', 90))).toEqual({
    status: 'rejected',
    reason: 'The score was finalized before this change could sync.',
  });
  expect(JSON.parse(store.get('ml-scoring-outbox:jury_1')!)).toEqual({});
});

test('queues are per jury', async () => {
  networkUp = false;
  await submitScore(score('a', 60));
  bindOutbox('jury_2');
  networkUp = true;
  await flushOutbox();
  expect(landed.size).toBe(0);
});

test('without a Clerk session (offline boot) scores wait instead of being rejected', async () => {
  signedIn = false;
  finalized.clear();
  expect(await submitScore(score('a', 75))).toEqual({ status: 'queued' });
  signedIn = true;
  await flushOutbox();
  expect(landed.get('a')).toBe(75);
});
