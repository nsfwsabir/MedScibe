import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createNote,
  fetchNote,
  fetchNotes,
  NoteFilters,
  NoteInsert,
  NoteUpdate,
  softDeleteNote,
  updateNote,
} from './notesApi';

export const notesKeys = {
  all: ['notes'] as const,
  list: (filters: NoteFilters) => ['notes', 'list', filters] as const,
  detail: (id: string) => ['notes', 'detail', id] as const,
};

export function useNotes(filters: NoteFilters = {}) {
  return useQuery({
    queryKey: notesKeys.list(filters),
    queryFn: () => fetchNotes(filters),
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: notesKeys.detail(id ?? ''),
    queryFn: () => fetchNote(id!),
    enabled: Boolean(id),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteInsert) => createNote(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NoteUpdate }) => updateNote(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });
}

export function useSoftDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
  });
}
