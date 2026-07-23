import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { friendlyErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';
import { track } from '../analytics';

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
      track('event_join_confirmed', { event_id: eventId, is_paid: false });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['my-joined-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userStats', user?.id] });
    },
  });
}
