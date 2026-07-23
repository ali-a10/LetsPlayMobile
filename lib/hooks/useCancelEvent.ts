import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { functionErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';
import { track } from '../analytics';

/** Calls the cancel-event Edge Function (host cancels their event, refunding paid participants in full), then refreshes event caches. */
export function useCancelEvent(eventId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error>({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('cancel-event', {
        body: { event_id: eventId },
      });
      if (error) throw new Error(await functionErrorMessage(error));
    },
    onSuccess: () => {
      track('event_cancelled_by_host', { event_id: eventId });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['my-joined-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-hosted-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userStats', user?.id] });
    },
  });
}
