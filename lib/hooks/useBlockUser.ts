import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { friendlyErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';

/** Calls the block_user RPC, which atomically inserts a block row and cleans up mutual upcoming participations. */
export function useBlockUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, string>({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('You must be logged in to block users.');
      const { error } = await supabase.rpc('block_user', {
        p_blocked_id: blockedId,
      });
      if (error) throw new Error(friendlyErrorMessage(error));
    },
    onSuccess: (_data, blockedId) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['my-joined-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-hosted-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userStats', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userStats', blockedId] });
      queryClient.invalidateQueries({ queryKey: ['blocked-users', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['is-blocked', blockedId, user?.id] });
    },
  });
}
