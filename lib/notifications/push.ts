import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../supabase';

// Foreground behavior: show a banner, no sound (the user is already in the app).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// The token this device registered during this app session, kept so sign-out can remove it.
let registeredToken: string | null = null;

/** Asks for notification permission, fetches this device's Expo push token, and saves it to Supabase. */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) return; // simulators/emulators can't receive push

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS as 'ios' | 'android',
    });
    if (error) {
      console.warn('Failed to save push token:', error.message);
      return;
    }
    registeredToken = token;
  } catch (err) {
    console.warn('Push registration failed:', err instanceof Error ? err.message : err);
  }
}

/** Removes this device's push token from Supabase so a signed-out device stops receiving pushes. */
export async function unregisterPushToken(): Promise<void> {
  try {
    if (!registeredToken) return;
    await supabase.rpc('unregister_push_token', { p_token: registeredToken });
    registeredToken = null;
  } catch (err) {
    console.warn('Push unregistration failed:', err instanceof Error ? err.message : err);
  }
}
