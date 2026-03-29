import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

/** Fetches the current user's profile row by user ID. */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

/** Returns a function that invalidates the profile cache for a given user ID. */
export function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return (userId: string) => queryClient.invalidateQueries({ queryKey: ['profile', userId] });
}
