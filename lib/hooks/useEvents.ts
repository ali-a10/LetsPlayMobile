import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Event } from '../types/database';
import { useFilterStore } from '../stores/filterStore';
import { useDebouncedValue } from './useDebouncedValue';
import { dayRangeIso } from '../utils/dateRange';

/** Event row joined with the host's profile data. */
export type EventWithHost = Event & {
  profiles: { first_name: string; last_name: string; avatar_url: string | null } | null;
};

/**
 * Fetches upcoming events (excluding the current user's own), applying the server-side
 * filters (sport, free-only, day, search) from the filter store, ordered by date ascending.
 */
export function useEvents() {
  const sport = useFilterStore((s) => s.sport);
  const date = useFilterStore((s) => s.date);
  const freeOnly = useFilterStore((s) => s.freeOnly);
  const searchText = useFilterStore((s) => s.searchText);
  const search = useDebouncedValue(searchText.trim(), 300);

  return useQuery<EventWithHost[]>({
    queryKey: ['events', { sport, date, freeOnly, search }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase
        .from('events')
        .select('*, profiles!host_id(first_name, last_name, avatar_url)')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });

      if (user) {
        query = query.neq('host_id', user.id);
      }

      if (sport) {
        query = query.eq('sport', sport);
      }

      if (freeOnly) {
        query = query.eq('is_paid', false);
      }

      if (date) {
        const { startIso, endIso } = dayRangeIso(date);
        query = query.gte('date', startIso).lt('date', endIso);
      }

      if (search) {
        // Strip characters that would break PostgREST's or() filter grammar.
        const term = search.replace(/[,()*%]/g, '');
        if (term) {
          query = query.or(
            `title.ilike.*${term}*,sport.ilike.*${term}*,location.ilike.*${term}*`
          );
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as EventWithHost[];
    },
  });
}
