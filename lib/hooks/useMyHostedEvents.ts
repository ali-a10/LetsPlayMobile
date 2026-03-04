import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { EventWithHost } from './useEvents';

/** Fetches upcoming events the current user is hosting, ordered by date ascending. */
export function useMyHostedEvents(userId: string | undefined) {
  return useQuery<EventWithHost[]>({
    queryKey: ['my-hosted-events', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, profiles!host_id(first_name, last_name)')
        .eq('host_id', userId!)
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });

      if (error) throw error;
      return (data ?? []) as EventWithHost[];
    },
    enabled: !!userId,
  });
}
