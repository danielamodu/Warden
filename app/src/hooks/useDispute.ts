import { useEffect, useState } from 'react';
import { escrowService } from '../services';
import type { DisputeRecord } from '../types';

export function useDispute(escrowId: string | undefined) {
  const [dispute, setDispute] = useState<DisputeRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!escrowId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    escrowService
      .getDispute(escrowId)
      .then((result) => {
        if (!cancelled) setDispute(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [escrowId]);

  return { dispute, loading, error };
}
