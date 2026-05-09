import { Stack } from 'expo-router';

/** Stack layout for user-profile routes, enabling iOS swipe-back gesture. */
export default function UserLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />
  );
}
