import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { functionErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';

/** Calls the refund-participant Edge Function to cancel a paid spot (refunding the participant), then refreshes the same caches as leaving an event. */
export function useCancelSpot(eventId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error>({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('refund-participant', {
        body: { event_id: eventId },
      });
      if (error) throw new Error(await functionErrorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['my-joined-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userStats', user?.id] });
    },
  });
}
