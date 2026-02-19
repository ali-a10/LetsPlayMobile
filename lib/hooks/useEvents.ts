import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Event } from '../types/database';

/** Fetches all upcoming events from Supabase, ordered by date ascending. */
export function useEvents() {
  return useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}
