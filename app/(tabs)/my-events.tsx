import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../lib/constants/colors';

/** Placeholder screen for the user's joined/RSVP'd events. */
export default function MyEventsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>My Events</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  text: {
    fontSize: 18,
    color: colors.text,
  },
});
