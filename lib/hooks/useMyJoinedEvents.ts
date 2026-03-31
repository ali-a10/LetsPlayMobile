import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { EventWithHost } from './useEvents';

/** Fetches upcoming events the user has joined but is not hosting, ordered by date ascending. */
export function useMyJoinedEvents(userId: string | undefined) {
  return useQuery<EventWithHost[]>({
    queryKey: ['my-joined-events', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, profiles!host_id(first_name, last_name, avatar_url), participants!inner(user_id)')
        .eq('participants.user_id', userId!)
        .neq('host_id', userId!)
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });

      if (error) throw error;
      return (data ?? []) as EventWithHost[];
    },
    enabled: !!userId,
  });
}
