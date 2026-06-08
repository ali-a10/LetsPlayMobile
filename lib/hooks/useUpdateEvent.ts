import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { friendlyErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';

/** Fields that can be updated on an event by the host.
 * MVP scope: only title and description. Other fields (date, location, price, etc.) are intentionally
 * locked here so the edit-event UI and the mutation can't drift apart — widen this type when the
 * broader edit flow lands. */
export type UpdateEventPayload = {
  title: string;
  description: string | null;
};

/** Updates an event row in Supabase and invalidates related caches on success. */
export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, UpdateEventPayload>({
    mutationFn: async (payload) => {
      const { error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', eventId);
      if (error) throw new Error(friendlyErrorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['my-hosted-events', user?.id] });
      // Host is auto-enrolled as a participant, so the title shows up in their joined list too.
      queryClient.invalidateQueries({ queryKey: ['my-joined-events', user?.id] });
    },
  });
}
