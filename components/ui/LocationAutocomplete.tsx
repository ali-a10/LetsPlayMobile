import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors } from '../../lib/constants/colors';

/** A place chosen from the autocomplete: a formatted address plus its coordinates. */
export interface SelectedPlace {
  address: string;
  latitude: number;
  longitude: number;
}

interface LocationAutocompleteProps {
  label?: string;
  error?: string;
  initialAddress?: string;
  onSelect: (place: SelectedPlace) => void;
}

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

/** ISO 3166-1 alpha-2 country codes to restrict autocomplete suggestions to. */
const INCLUDED_COUNTRIES = ['ca'];

/** Suggestions don't fire until the user has typed at least this many characters. */
const MIN_LENGTH = 4;
/** Wait this long after the last keystroke before firing an autocomplete request. */
const DEBOUNCE_MS = 400;

/** Maximum suggestion-list height — fits Google's default of up to 5 predictions. */
const LIST_MAX_HEIGHT = 240;

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

type Suggestion = { placeId: string; text: string };

/** Google Places (New) address field that reports the chosen place's formatted address and coordinates. */
export function LocationAutocomplete({
  label,
  error,
  initialAddress,
  onSelect,
}: LocationAutocompleteProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [text, setText] = useState(initialAddress ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);

  // Prefill the visible text once when an initial address arrives (e.g. when editing an event).
  useEffect(() => {
    if (!initializedRef.current && initialAddress) {
      setText(initialAddress);
      initializedRef.current = true;
    }
  }, [initialAddress]);

  // Cancel any in-flight work on unmount so a slow response can't update a dead component.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  /** Calls Place Autocomplete (New) and replaces the visible suggestion list. */
  const fetchSuggestions = async (input: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
        },
        body: JSON.stringify({ input, includedRegionCodes: INCLUDED_COUNTRIES }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.warn('[LocationAutocomplete] autocomplete failed:', res.status, err);
        setSuggestions([]);
        return;
      }
      const json = await res.json();
      const next: Suggestion[] = (json.suggestions ?? [])
        .map((s: any) => s?.placePrediction)
        .filter(Boolean)
        .map((p: any) => ({
          placeId: p.placeId,
          text: p.text?.text ?? '',
        }));
      setSuggestions(next);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.warn('[LocationAutocomplete] autocomplete error:', e);
      }
    } finally {
      // The abort guard keeps the loader on if a newer request superseded this one.
      if (abortRef.current === controller) setLoading(false);
    }
  };

  /** Updates the visible text and schedules a debounced autocomplete fetch. */
  const handleChangeText = (next: string) => {
    setText(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.length < MIN_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(next), DEBOUNCE_MS);
  };

  /** Fetches Place Details (New) for the chosen suggestion and reports address + coords. */
  const handleSelect = async (suggestion: Suggestion) => {
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setText(suggestion.text);
    setSuggestions([]);
    setLoading(true);
    try {
      const res = await fetch(`${DETAILS_URL}/${suggestion.placeId}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'formattedAddress,location',
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.warn('[LocationAutocomplete] details failed:', res.status, err);
        return;
      }
      const json = await res.json();
      const loc = json?.location;
      if (!loc || loc.latitude == null || loc.longitude == null) {
        console.warn('[LocationAutocomplete] details missing location:', json);
        return;
      }
      onSelect({
        address: json.formattedAddress ?? suggestion.text,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
    } catch (e) {
      console.warn('[LocationAutocomplete] details error:', e);
    } finally {
      setLoading(false);
    }
  };

  const showList = focused && suggestions.length > 0;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.textInput, error ? styles.textInputError : null]}
          placeholder="Search for a place or address"
          placeholderTextColor={colors.inputPlaceholder}
          value={text}
          onChangeText={handleChangeText}
          onFocus={() => setFocused(true)}
          // Delay hiding the list slightly so a tap on a row still registers before blur.
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading ? (
          <View style={styles.loaderOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : null}
        {showList ? (
          <View style={styles.listView}>
            {suggestions.map((s, i) => (
              <Pressable
                key={s.placeId}
                style={({ pressed }) => [
                  styles.row,
                  i < suggestions.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => handleSelect(s)}
              >
                <Text style={styles.description} numberOfLines={2}>
                  {s.text}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: 16,
      // Raise above following form fields so the results dropdown overlays them.
      zIndex: 10,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 6,
    },
    inputWrapper: {
      position: 'relative',
    },
    textInput: {
      height: 50,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingRight: 40,
      fontSize: 16,
      color: colors.inputText,
      backgroundColor: colors.inputBg,
    },
    textInputError: {
      borderColor: colors.error,
    },
    loaderOverlay: {
      position: 'absolute',
      right: 14,
      top: 15,
    },
    listView: {
      position: 'absolute',
      top: 54,
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      zIndex: 1000,
      elevation: 5,
      maxHeight: LIST_MAX_HEIGHT,
      overflow: 'hidden',
    },
    row: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.card,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    rowPressed: {
      backgroundColor: colors.cardTint,
    },
    description: {
      fontSize: 14,
      color: colors.text,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
  });
}
