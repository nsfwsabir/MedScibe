import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createMacro, deleteMacro, fetchMacros, MacroInput } from './macrosApi';

export const macrosKeys = {
  all: ['macros'] as const,
};

export function useMacros() {
  return useQuery({
    queryKey: macrosKeys.all,
    queryFn: fetchMacros,
  });
}

export function useCreateMacro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MacroInput) => createMacro(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: macrosKeys.all }),
  });
}

export function useDeleteMacro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMacro(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: macrosKeys.all }),
  });
}
