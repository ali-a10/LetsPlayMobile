import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Event } from '../types/database';

/** Event row joined with the host's profile data. */
export type EventWithHost = Event & {
  profiles: { first_name: string; last_name: string } | null;
};

/** Fetches all upcoming events excluding the current user's own events, ordered by date ascending. */
export function useEvents() {
  return useQuery<EventWithHost[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase
        .from('events')
        .select('*, profiles!host_id(first_name, last_name)')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });

      if (user) {
        query = query.neq('host_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as EventWithHost[];
    },
  });
}
