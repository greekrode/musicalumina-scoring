import type { User } from '../types';

// Last-known data and identity for jury devices, so the app can reopen with no
// connection. Nothing here grants access: every write still syncs through the
// outbox with a live Clerk token, which the server verifies.

const DATA_PREFIX = 'ml-scoring-cache:';
const IDENTITY_KEY = 'ml-scoring-identity';

export function readCache<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(DATA_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(DATA_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: offline reload just has less to show.
  }
}

/** Jury user to reopen as when offline. Only jury get an offline mode. */
export function readIdentity(): User | null {
  try {
    const user = JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null');
    return user && typeof user.id === 'string' && user.role === 'jury' ? user : null;
  } catch {
    return null;
  }
}

export function saveIdentity(user: User | null) {
  try {
    if (user?.role === 'jury') localStorage.setItem(IDENTITY_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

/** On sign-out: drop identity and cached data. Unsynced scores stay queued. */
export function clearOfflineData() {
  try {
    localStorage.removeItem(IDENTITY_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DATA_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
