import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Event } from '../types/database';

/** Event row joined with the host's profile data. */
export type EventWithHost = Event & {
  profiles: { first_name: string; last_name: string } | null;
};

/** Fetches all upcoming events from Supabase joined with host profiles, ordered by date ascending. */
export function useEvents() {
  return useQuery<EventWithHost[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, profiles!host_id(first_name, last_name)')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });

      if (error) throw error;
      return (data ?? []) as EventWithHost[];
    },
  });
}
