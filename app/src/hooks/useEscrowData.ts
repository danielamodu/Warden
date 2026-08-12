import { useEffect, useState } from 'react';
import { escrowService } from '../services';
import type { Escrow } from '../types';

interface UseEscrowDataResult {
  escrow: Escrow | null;
  loading: boolean;
  error: string | null;
}

export function useEscrowData(id: string | undefined): UseEscrowDataResult {
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    escrowService
      .getEscrow(id)
      .then((result) => {
        if (!cancelled) setEscrow(result);
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
  }, [id]);

  return { escrow, loading, error };
}

export function useEscrowList() {
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    escrowService.listEscrows().then((result) => {
      if (!cancelled) {
        setEscrows(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { escrows, loading };
}
