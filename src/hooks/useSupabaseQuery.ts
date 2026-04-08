import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSupabaseQueryOptions {
  enabled?: boolean;
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
 * @param options - { enabled } to conditionally skip the query
 */
export function useSupabaseQuery<T>(
  queryFn: () => Promise<T>,
  deps: unknown[],
  initialData: T,
  options?: UseSupabaseQueryOptions
): UseSupabaseQueryResult<T> {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const queryFnRef = useRef(queryFn);
  const hasFetchedRef = useRef(false);

  // Keep queryFn ref fresh without re-triggering the fetch effect
  useEffect(() => {
    queryFnRef.current = queryFn;
  });

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await queryFnRef.current();
      if (requestId === requestIdRef.current) {
        setData(result);
        hasFetchedRef.current = true;
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
