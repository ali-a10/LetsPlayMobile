import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type UserStats = { joined: number; hosted: number };

/** Fetches the joined/hosted event counts for any user by ID. */
export function useUserStats(userId: string | undefined) {
  return useQuery<UserStats>({
    queryKey: ['userStats', userId],
    queryFn: async () => {
      const [joinedRes, hostedRes] = await Promise.all([
        supabase
          .from('participants')
          .select('event_id', { count: 'exact', head: true })
          .eq('user_id', userId!),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('host_id', userId!),
      ]);

      if (joinedRes.error) throw joinedRes.error;
      if (hostedRes.error) throw hostedRes.error;

      return {
        joined: joinedRes.count ?? 0,
        hosted: hostedRes.count ?? 0,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

/** Returns a function that invalidates the cached stats for a given user ID. */
export function useInvalidateUserStats() {
  const queryClient = useQueryClient();
  return (userId: string) => queryClient.invalidateQueries({ queryKey: ['userStats', userId] });
}
