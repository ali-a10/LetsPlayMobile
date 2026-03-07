import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { friendlyErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';

/** Fields that can be updated on an event by the host. */
export type UpdateEventPayload = {
  title: string;
  description: string | null;
  date: string;
  location: string;
  max_participants: number;
  price: number | null;
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
    },
  });
}
