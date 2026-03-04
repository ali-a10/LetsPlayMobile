import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { friendlyErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';

/** Calls the join_event RPC and invalidates event caches on success. */
export function useJoinEvent(eventId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error>({
    mutationFn: async () => {
      const { error } = await supabase.rpc('join_event', {
        p_event_id: eventId,
      });
      if (error) throw new Error(friendlyErrorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['my-joined-events', user?.id] });
    },
  });
}
