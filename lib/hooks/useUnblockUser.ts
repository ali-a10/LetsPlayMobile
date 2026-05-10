import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { friendlyErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';

/** Deletes the block row from the current user toward `blockedId` and invalidates affected caches. */
export function useUnblockUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, string>({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('You must be logged in to unblock users.');
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);
      if (error) throw new Error(friendlyErrorMessage(error));
    },
    onSuccess: (_data, blockedId) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['my-joined-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['blocked-users', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['is-blocked', blockedId, user?.id] });
    },
  });
}
