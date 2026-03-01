import { Stack } from 'expo-router';

/** Stack layout for event routes, enabling iOS swipe-back gesture. */
export default function EventLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />
  );
}
