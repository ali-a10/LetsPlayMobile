import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useThemeColors } from '../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../lib/constants/colors';

// When the full terms/policies go live on the site, deep-link straight to them (§12.3).
const TERMS_URL = 'https://letsplayapp.ca';
const LAST_UPDATED = 'July 8, 2026';

// Enable LayoutAnimation on Android (opt-in there; on by default on iOS).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Plain-language reference screen explaining fees, refunds, cancellations, and payouts for paid events. */
export default function HowPaidEventsWorkScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={sharedColors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How paid events work</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>

        <CollapsibleSection title="What's the 12-hour rule?" styles={styles}>
          <Text style={styles.body}>
            Almost everything here comes down to one rule:{' '}
            <Text style={styles.bodyStrong}>cancellations close 12 hours before an event starts.</Text>
          </Text>
          <Text style={styles.body}>
            Up until then, you can cancel your spot and hosts can cancel their event. Inside the final
            12 hours, spots and events are locked in — so everyone attending has a fair, reliable
            headcount.
          </Text>
        </CollapsibleSection>

        <CollapsibleSection title="What do I pay when I join a paid event?" styles={styles}>
          <Text style={styles.body}>
            You pay the host's price, plus a small LetsPlay service fee and the card-processing fee.
            You always see the exact breakdown before you pay.
          </Text>
          <Text style={styles.body}>
            <Text style={styles.bodyStrong}>Example:</Text> for a $10.00 event you pay{' '}
            <Text style={styles.bodyStrong}>$10.92</Text> at checkout — $10.00 event price + $0.30
            service fee + $0.62 payment processing.
          </Text>
        </CollapsibleSection>

        <CollapsibleSection title="Can I cancel my spot after joining an event?" styles={styles}>
          <Text style={styles.body}>
            <Text style={styles.bodyStrong}>More than 12 hours before the start:</Text> yes — cancel
            from the event page and you're refunded automatically. You get back everything except the
            card-processing fee: the event price and service fee are returned.
          </Text>
          <Text style={styles.body}>
            On the $10.92 example, you'd get <Text style={styles.bodyStrong}>$10.30</Text> back.
            Refunds are issued right away and usually appear on your statement within 5–10 business
            days.
          </Text>
          <Text style={styles.body}>
            <Text style={styles.bodyStrong}>Within 12 hours of the start:</Text> your spot can't be
            cancelled and no refund is issued. The app warns you about this before you join an event
            that starts soon.
          </Text>
        </CollapsibleSection>

        <CollapsibleSection title="What happens if the host cancels the event?" styles={styles}>
          <Text style={styles.body}>
            If a host cancels a paid event, every participant is refunded{' '}
            <Text style={styles.bodyStrong}>100% of what they paid</Text> — event price, service fee,
            and processing fee. LetsPlay absorbs the processing cost.
          </Text>
          <Text style={styles.body}>
            Hosts can't cancel inside the final 12 hours. Cancelling less than 48 hours before the
            start is recorded as a late cancellation, and hosts who repeatedly cancel late may
            temporarily lose the ability to host.
          </Text>
        </CollapsibleSection>

        <CollapsibleSection title="What if the host doesn't show up?" styles={styles}>
          <Text style={styles.body}>
            If you paid and the host didn't show, you can report a host no-show from the event page —
            from the event's start time and for up to 24 hours afterward.
          </Text>
          <Text style={styles.body}>
            Our team reviews every report. If we confirm the host didn't show up, affected
            participants are refunded in full. Reports are confidential.
          </Text>
        </CollapsibleSection>

        <CollapsibleSection title="How and when do hosts get paid?" styles={styles}>
          <Text style={styles.body}>
            Hosts keep the full event price for each paid spot — on a $10.00 event, the host receives
            $10.00. The fees are added on the participant's side, so they never come out of the host's
            earnings.
          </Text>
          <Text style={styles.body}>
            Earnings are released to the host's connected account{' '}
            <Text style={styles.bodyStrong}>about 24 hours after the event ends.</Text> You can track
            pending and paid-out earnings anytime on the Payouts screen.
          </Text>
        </CollapsibleSection>

        <CollapsibleSection title="What if I dispute a charge with my bank?" styles={styles}>
          <Text style={styles.body}>
            If you dispute a charge through your bank or card issuer, that payment moves into your
            bank's dispute process and can no longer be cancelled or refunded through the app.
          </Text>
          <Text style={styles.body}>
            If something went wrong with an event, please contact us first — refunds through LetsPlay
            are usually much faster than a bank dispute.
          </Text>
        </CollapsibleSection>

        <TouchableOpacity
          style={styles.termsLink}
          onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
          activeOpacity={0.7}
        >
          <Text style={styles.termsLinkText}>View full terms on letsplayapp.ca</Text>
          <Ionicons name="open-outline" size={16} color={colors.sectionTitle} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/** A tap-to-expand card: shows the question, and reveals its answer with a smooth animation when open. */
function CollapsibleSection({
  title,
  children,
  styles,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  const [open, setOpen] = useState(false);

  /** Toggles the section open/closed, animating the height change. */
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} style={styles.sectionChevron} />
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.header,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    backBtn: {
      width: 40,
      alignItems: 'flex-start',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: sharedColors.white,
    },
    content: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      flexGrow: 1,
    },
    lastUpdated: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 16,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 10,
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 12,
    },
    sectionTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    sectionChevron: {
      color: colors.chevron,
    },
    sectionBody: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 12,
    },
    body: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 21,
    },
    bodyStrong: {
      color: colors.text,
      fontWeight: '600',
    },
    termsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      marginTop: 8,
    },
    termsLinkText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.sectionTitle,
    },
  });
}
