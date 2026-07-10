import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { EventWithHost } from './useEvents';

/** Fetches events the user joined (not hosted) that started within the last 7 days, newest first — the "Past" list. */
export function useRecentlyEndedJoinedEvents(userId: string | undefined) {
  return useQuery<EventWithHost[]>({
    queryKey: ['recently-ended-joined-events', userId],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('events')
        .select('*, profiles!host_id(first_name, last_name, avatar_url), participants!inner(user_id)')
        .eq('participants.user_id', userId!)
        .neq('host_id', userId!)
        .gte('date', weekAgoIso)
        .lt('date', nowIso)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data ?? []) as EventWithHost[];
    },
    enabled: !!userId,
  });
}
