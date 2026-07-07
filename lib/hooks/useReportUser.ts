import { useMutation } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { friendlyErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';
import { ReportReason } from '../types/database';

export interface ReportUserInput {
  reportedId: string;
  reason: ReportReason;
  details?: string;
  /** Links the report to an event — required for a host no-show report to hold that event's payout. */
  eventId?: string;
}

/** Submits a user report to the `reports` table. Reports are insert-only for the reporter. */
export function useReportUser() {
  const { user } = useAuth();

  return useMutation<void, Error, ReportUserInput>({
    mutationFn: async ({ reportedId, reason, details, eventId }) => {
      if (!user) throw new Error('You must be logged in to report users.');
      const trimmed = details?.trim();
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_id: reportedId,
          reason,
          event_id: eventId ?? null,
          details: trimmed ? trimmed : null,
        });
      if (error) throw new Error(friendlyErrorMessage(error));
    },
  });
}
