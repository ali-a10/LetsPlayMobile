import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

/** A blocked user row joined to the blocked profile's display fields. */
export type BlockedUser = {
  blocked_id: string;
  created_at: string;
  profiles: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
};

/** Fetches the viewer's outgoing blocks, joined to each blocked user's profile, newest first. */
export function useBlockedUsers(viewerId: string | undefined) {
  return useQuery<BlockedUser[]>({
    queryKey: ['blocked-users', viewerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocks')
        .select('blocked_id, created_at, profiles!blocked_id(first_name, last_name, avatar_url)')
        .eq('blocker_id', viewerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BlockedUser[];
    },
    enabled: !!viewerId,
    staleTime: 1000 * 30,
  });
}
