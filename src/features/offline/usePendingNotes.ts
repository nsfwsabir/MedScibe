import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPendingNotes, syncPendingNotes } from './pendingNotes';

export const pendingKeys = {
  all: ['pending-notes'] as const,
  list: ['pending-notes', 'list'] as const,
};

export function usePendingNotes() {
  return useQuery({
    queryKey: pendingKeys.list,
    queryFn: fetchPendingNotes,
  });
}

export function useSyncPendingNotes() {
  const qc = useQueryClient();
  return useCallback(async () => {
    const res = await syncPendingNotes();
    await qc.invalidateQueries({ queryKey: pendingKeys.all });
    await qc.invalidateQueries({ queryKey: ['notes'] });
    return res;
  }, [qc]);
}
