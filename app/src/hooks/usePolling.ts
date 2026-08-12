import { useEffect, useRef } from 'react';

/**
 * Calls `callback` every `ms` milliseconds while `enabled` is true.
 * Mirrors the docs' usePolling(callback, ms, enabled) signature — intended
 * for a future RealEscrowService that polls live RPC/indexer state.
 */
export function usePolling(callback: () => void, ms: number, enabled: boolean = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => savedCallback.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}
