import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/** Returns true when the viewer has blocked the target user. */
export function useIsBlocked(targetId: string | undefined, viewerId: string | undefined) {
  return useQuery<boolean>({
    queryKey: ['is-blocked', targetId, viewerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocks')
        .select('blocker_id')
        .eq('blocker_id', viewerId!)
        .eq('blocked_id', targetId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!targetId && !!viewerId && targetId !== viewerId,
    staleTime: 1000 * 60,
  });
}
