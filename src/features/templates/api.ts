import { useMutation, useQuery } from '@tanstack/react-query';

import { keys } from '../../data/keys';
import { deleteTemplateMutation, mutationKeys, saveTemplateMutation } from '../../data/queryClient';
import { getRepo } from '../../data/repo';
import { stampOwner } from '../../data/sessionUser';
import type { Template } from '../../data/types';

export function useTemplates() {
  return useQuery({
    queryKey: keys.templates,
    queryFn: () => getRepo().listTemplates(),
  });
}

export function useSaveTemplate() {
  const mutation = useMutation({
    mutationKey: mutationKeys.saveTemplate,
    mutationFn: saveTemplateMutation,
  });
  return {
    ...mutation,
    mutateAsync: (template: Template) => mutation.mutateAsync(stampOwner(template)),
  };
}

export function useDeleteTemplate() {
  const mutation = useMutation({
    mutationKey: mutationKeys.deleteTemplate,
    mutationFn: deleteTemplateMutation,
  });
  return {
    ...mutation,
    mutateAsync: (id: string) => mutation.mutateAsync(stampOwner({ id })),
  };
}
