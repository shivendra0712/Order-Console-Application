import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from '../api/client';

interface State<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

/**
 * Loads data with `fetcher` whenever `deps` change. Stale responses from
 * earlier requests are ignored, so fast typing in a search box is safe.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const requestId = useRef(0);

  const load = useCallback(fetcher, deps);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await load();
      if (id === requestId.current) setState({ data, error: null, loading: false });
    } catch (e) {
      const error = e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', (e as Error).message);
      if (id === requestId.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setData = useCallback((data: T) => setState((s) => ({ ...s, data })), []);

  return { ...state, reload, setData };
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
