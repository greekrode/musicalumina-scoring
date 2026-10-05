import { useCallback, useEffect, useRef, useState } from 'react';
import { readCache, writeCache } from '../lib/offlineCache';

interface UseSupabaseQueryOptions {
  enabled?: boolean;
  /**
   * Keep the last result on this device under this key. It is shown while
   * refetching and whenever the fetch fails, so jury screens work offline.
   */
  cacheKey?: string;
}

interface UseSupabaseQueryResult<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic hook for Supabase data fetching.
 * Eliminates the repeated useState/useEffect/async-fetch boilerplate.
 *
 * @param queryFn - async function that returns data
 * @param deps - dependency array that triggers re-fetch when changed
 * @param initialData - initial value for data before first fetch
 * @param options - { enabled } to conditionally skip the query, { cacheKey } to keep it offline
 */
export function useSupabaseQuery<T>(
  queryFn: () => Promise<T>,
  deps: unknown[],
  initialData: T,
  options?: UseSupabaseQueryOptions
): UseSupabaseQueryResult<T> {
  const enabled = options?.enabled ?? true;
  const cacheKey = options?.cacheKey;
  const [data, setData] = useState<T>(() => (cacheKey && readCache<T>(cacheKey)) || initialData);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const queryFnRef = useRef(queryFn);
  const cacheKeyRef = useRef(cacheKey);
  const hasFetchedRef = useRef(false);

  // Keep queryFn ref fresh without re-triggering the fetch effect
  useEffect(() => {
    queryFnRef.current = queryFn;
    cacheKeyRef.current = cacheKey;
  });

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const key = cacheKeyRef.current;
    const cached = key ? readCache<T>(key) : undefined;
    if (cached !== undefined) setData(cached);

    // Offline boot (no Clerk session): a query would run as anon and RLS
    // would return nothing, so stay on the cached copy.
    if (key && !window.Clerk?.session) {
      setError(cached === undefined ? 'Offline: no saved copy on this device yet' : null);
      setIsLoading(false);
      return;
    }

    setIsLoading(cached === undefined);
    setError(null);

    try {
      const result = await queryFnRef.current();
      if (requestId === requestIdRef.current) {
        setData(result);
        hasFetchedRef.current = true;
        if (key) writeCache(key, result);
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []); // stable — uses ref internally

  useEffect(() => {
    if (!enabled) {
      // Only reset to initialData before the first successful fetch
      if (!hasFetchedRef.current) {
        setData(initialData);
      }
      setIsLoading(false);
      setError(null);
      return;
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
