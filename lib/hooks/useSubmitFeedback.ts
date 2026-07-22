import { useMutation } from '@tanstack/react-query';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../supabase';
import { friendlyErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';
import { track } from '../analytics';
import { FeedbackCategory } from '../types/database';

export interface SubmitFeedbackInput {
  category: FeedbackCategory;
  message: string;
}

/** Returns the running platform if it matches the `feedback.platform` enum, otherwise null. */
function getPlatform(): 'ios' | 'android' | null {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return Platform.OS;
  }
  return null;
}

/** Submits a feedback entry to the `feedback` table. Insert-only — RLS denies select/update/delete. */
export function useSubmitFeedback() {
  const { user } = useAuth();

  return useMutation<void, Error, SubmitFeedbackInput>({
    mutationFn: async ({ category, message }) => {
      if (!user) throw new Error('You must be logged in to send feedback.');
      const trimmed = message.trim();
      // Do NOT chain .select() — the feedback table has no SELECT RLS policy, so
      // the returned row would be empty and the call would look broken.
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        category,
        message: trimmed,
        app_version: Constants.expoConfig?.version ?? null,
        platform: getPlatform(),
      });
      if (error) throw new Error(friendlyErrorMessage(error));
    },
    onSuccess: (_data, variables) => {
      track('feedback_submitted', { category: variables.category });
    },
  });
}
