import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { buildEarningsSummary, EarningsSummary, EarningsPayment } from '../utils/earnings';

/** Fetches the host's succeeded/transferred payments (joined to their events) and aggregates them into an earnings summary. */
export function useHostEarnings(userId: string | undefined) {
  return useQuery<EarningsSummary>({
    queryKey: ['host-earnings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(
          'event_id, amount_host_cents, status, disputed_at, payout_failed_reason, events(title, date, payout_held_at)'
        )
        .eq('host_id', userId!)
        .in('status', ['succeeded', 'transferred']);

      if (error) throw error;
      return buildEarningsSummary((data ?? []) as unknown as EarningsPayment[]);
    },
    enabled: !!userId,
    staleTime: 1000 * 60,
  });
}
