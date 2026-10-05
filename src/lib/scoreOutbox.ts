import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';

// Offline-first jury submissions. Every score goes into a per-jury outbox in
// localStorage first, then syncs through the submit_jury_score RPC (idempotent,
// so a replay after a lost response is harmless). While anything is queued or
// the server is unreachable, a ping polls the API and flushes on recovery.

export interface QueuedScore {
  registrationId: string;
  participantName: string;
  finalScore: number;
  remarks: string;
  juryName: string;
  queuedAt: string;
  lastError?: string;
}

export interface RejectedScore extends QueuedScore {
  reason: string;
}

interface OutboxState {
  online: boolean;
  syncing: boolean;
  queued: Record<string, QueuedScore>;
  rejected: RejectedScore[];
  /** Bumps after each successful sync so views can refetch. */
  syncedVersion: number;
}

const REJECT_REASONS: Record<string, string> = {
  finalized: 'The score was finalized before this change could sync.',
  forbidden: 'This account is not allowed to submit scores.',
  invalid_score: 'Score must be between 0.1 and 100 with at most one decimal.',
  invalid_remarks: 'Remarks are too long (2000 characters max).',
  not_found: 'This registration no longer exists.',
  event_closed: 'This event is no longer accepting scores.',
};

const POLL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 8_000;

let juryId: string | null = null;
let state: OutboxState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  queued: {},
  rejected: [],
  syncedVersion: 0,
};
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
let rerun = false;

const storageKey = (id: string) => `ml-scoring-outbox:${id}`;

function set(patch: Partial<OutboxState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function persist() {
  if (!juryId) return;
  try {
    localStorage.setItem(storageKey(juryId), JSON.stringify(state.queued));
  } catch {
    // Storage blocked or full: the queue still lives in memory for this tab.
  }
}

function load(id: string): Record<string, QueuedScore> {
  try {
    const raw = localStorage.getItem(storageKey(id));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function withTimeout<T>(promise: PromiseLike<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
  ]);
}

/** True when the API answers at all (any HTTP status). */
export async function ping(): Promise<boolean> {
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      cache: 'no-store',
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(5_000),
    });
    return true;
  } catch {
    return false;
  }
}

type SendResult = { ok: true } | { ok: false; retry: boolean; message: string };

async function send(item: QueuedScore): Promise<SendResult> {
  try {
    // Without a Clerk session (offline boot) the RPC would run as anon and
    // answer "forbidden", which would wrongly drop the score. Wait instead.
    const token = await withTimeout(Promise.resolve(window.Clerk?.session?.getToken() ?? null));
    if (!token) return { ok: false, retry: true, message: 'Waiting for sign-in' };

    const { data, error } = await withTimeout(
      supabase.rpc('submit_jury_score', {
        p_registration_id: item.registrationId,
        p_final_score: item.finalScore,
        p_remarks: item.remarks,
        p_jury_name: item.juryName,
      })
    );
    // Transport, auth-refresh or server errors: keep it queued and retry.
    if (error) return { ok: false, retry: true, message: error.message };
    const code = (data as { error?: string } | null)?.error;
    if (code) return { ok: false, retry: false, message: REJECT_REASONS[code] ?? code };
    return { ok: true };
  } catch (err) {
    return { ok: false, retry: true, message: err instanceof Error ? err.message : 'Network error' };
  }
}

async function drain() {
  set({ syncing: true });
  let synced = false;
  try {
    // Loop so scores queued while a sync is running go out in the same pass.
    for (;;) {
      if (!navigator.onLine) {
        set({ online: false });
        break;
      }
      const next =Object.values(state.queued).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))[0];
      if (!next) break;
      const result = await send(next);
      const current = state.queued[next.registrationId];
      // Edited again during the request: keep the newer version queued.
      const superseded = current && current.queuedAt !== next.queuedAt;

      if (result.ok || !result.retry) {
        if (!superseded) {
          const rest = { ...state.queued };
          delete rest[next.registrationId];
          set({ queued: rest });
          persist();
        }
        if (result.ok) synced = true;
        else set({ rejected: [...state.rejected, { ...next, reason: result.message }] });
        if (superseded) continue;
        set({ online: true });
      } else {
        if (!superseded) {
          set({ queued: { ...state.queued, [next.registrationId]: { ...next, lastError: result.message } } });
          persist();
        }
        set({ online: await ping() });
        break;
      }
    }
  } finally {
    set({ syncing: false, ...(synced ? { syncedVersion: state.syncedVersion + 1 } : {}) });
  }
}

/**
 * Sends everything queued. A call during a running pass schedules one more
 * pass (the running one may already have stopped on an error), and every
 * caller waits for both.
 */
export function flushOutbox(): Promise<void> {
  if (!juryId) return Promise.resolve();
  if (inflight) {
    rerun = true;
    return inflight;
  }
  inflight = (async () => {
    do {
      rerun = false;
      await drain();
    } while (rerun);
  })().finally(() => (inflight = null));
  return inflight;
}

export type SubmitOutcome =
  | { status: 'synced' }
  | { status: 'queued' }
  | { status: 'rejected'; reason: string };

/** Queue a score, try to send it now, and report where it ended up. */
export async function submitScore(item: Omit<QueuedScore, 'queuedAt' | 'lastError'>): Promise<SubmitOutcome> {
  const queued: QueuedScore = { ...item, queuedAt: new Date().toISOString() };
  set({
    queued: { ...state.queued, [item.registrationId]: queued },
    rejected: state.rejected.filter((r) => r.registrationId !== item.registrationId),
  });
  persist();
  await flushOutbox();

  const rejected = state.rejected.find((r) => r.registrationId === item.registrationId && r.queuedAt === queued.queuedAt);
  if (rejected) return { status: 'rejected', reason: rejected.reason };
  return state.queued[item.registrationId]?.queuedAt === queued.queuedAt ? { status: 'queued' } : { status: 'synced' };
}

export function dismissRejected(registrationId: string) {
  set({ rejected: state.rejected.filter((r) => r.registrationId !== registrationId) });
}

/** Switches the outbox to this jury's saved queue and starts syncing it. */
export function bindOutbox(userId: string | null | undefined) {
  juryId = userId ?? null;
  set({ queued: userId ? load(userId) : {}, rejected: [] });
  if (userId) flushOutbox();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOutbox(): OutboxState {
  return useSyncExternalStore(subscribe, () => state);
}

/**
 * Binds the outbox to the signed-in jury and keeps it syncing: polls while
 * anything is queued or the API is unreachable, and flushes on reconnect,
 * tab focus, and changes made in other tabs.
 */
export function useOutboxSync(userId: string | null | undefined) {
  const { queued, online } = useOutbox();
  const pending = Object.keys(queued).length > 0;

  useEffect(() => bindOutbox(userId), [userId]);

  useEffect(() => {
    if (!userId) return;
    const kick = () => flushOutbox();
    const goOffline = () => set({ online: false });
    const onVisible = () => document.visibilityState === 'visible' && kick();
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(userId)) set({ queued: load(userId) });
    };
    window.addEventListener('online', kick);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('online', kick);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || (!pending && online)) return;
    const timer = setInterval(async () => {
      if (inflight) return;
      const reachable = await ping();
      if (reachable !== state.online) set({ online: reachable });
      if (reachable && Object.keys(state.queued).length) flushOutbox();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [userId, pending, online]);
}
