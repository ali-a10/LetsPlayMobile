import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from './useAuth';
import { Event } from '../types/database';

export type ParticipantWithProfile = {
  user_id: string;
  profiles: { first_name: string; last_name: string } | null;
};

export type EventDetail = Event & {
  profiles: { first_name: string; last_name: string } | null;
  participants: ParticipantWithProfile[];
  isUserHost: boolean;
  isUserJoined: boolean;
  isFull: boolean;
};

/** Fetches full event detail — event row, host profile, and participant list with names — and computes derived join/host/full state. */
export function useEventDetail(eventId: string) {
  const { user } = useAuth();

  return useQuery<EventDetail>({
    queryKey: ['event', eventId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          profiles!host_id(first_name, last_name),
          participants(
            user_id,
            profiles!user_id(first_name, last_name)
          )
        `)
        .eq('id', eventId)
        .single();

      if (error) throw error;

      const raw = data as any;
      const participants: ParticipantWithProfile[] = raw.participants ?? [];

      return {
        ...raw,
        participants,
        isUserHost: raw.host_id === user?.id,
        isUserJoined: participants.some((p) => p.user_id === user?.id),
        isFull: raw.current_participants >= raw.max_participants,
      } as EventDetail;
    },
    enabled: !!eventId && !!user,
  });
}
