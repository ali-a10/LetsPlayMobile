import { useCallback } from 'react';
import * as Location from 'expo-location';
import { useLocationStore } from '../stores/useLocationStore';
import { useFilterStore } from '../stores/filterStore';

/** Reuse cached coordinates for this long before querying GPS again. */
const COORDS_TTL_MS = 5 * 60 * 1000;

/** Give up on a live GPS fix after this long so the UI never hangs indefinitely. */
const GPS_TIMEOUT_MS = 12 * 1000;

/** Outcome of attempting to enable the Nearest sort. */
type EnableResult = { ok: boolean; denied?: boolean };

/**
 * Provides helpers to enable the "Nearest" sort, handling just-in-time foreground
 * location permission, cached coordinates, and permission-status syncing.
 */
export function useNearestSort() {
  const status = useLocationStore((s) => s.status);
  const lastFetchedAt = useLocationStore((s) => s.lastFetchedAt);
  const setStatus = useLocationStore((s) => s.setStatus);
  const setCoords = useLocationStore((s) => s.setCoords);
  const setSortBy = useFilterStore((s) => s.setSortBy);

  /** Silently mirrors the OS foreground-location permission into the store (never prompts). */
  const syncPermission = useCallback(async () => {
    const { status: perm } = await Location.getForegroundPermissionsAsync();
    setStatus(perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'undetermined');
  }, [setStatus]);

  /** Fetches and caches the device's coordinates (last-known first, then a time-boxed live fix). */
  const refreshCoords = useCallback(async () => {
    let pos = await Location.getLastKnownPositionAsync();
    if (!pos) {
      // Time-box the live fix so a cold GPS indoors can't hang the UI forever.
      pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), GPS_TIMEOUT_MS)),
      ]);
    }
    if (pos) setCoords(pos.coords.latitude, pos.coords.longitude);
    return pos;
  }, [setCoords]);

  /** Activates the Nearest sort, requesting permission and coordinates as needed. */
  const enableNearest = useCallback(async (): Promise<EnableResult> => {
    if (status === 'denied') {
      return { ok: false, denied: true };
    }

    // Permission not yet decided — prompt just-in-time.
    if (status === 'undetermined') {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setStatus('denied');
        return { ok: false, denied: true };
      }
      setStatus('granted');
    }

    // Granted: reuse fresh cached coords, otherwise fetch.
    const fresh = lastFetchedAt != null && Date.now() - lastFetchedAt < COORDS_TTL_MS;
    if (!fresh) {
      try {
        const pos = await refreshCoords();
        if (!pos) return { ok: false };
      } catch {
        return { ok: false };
      }
    }

    setSortBy('nearest');
    return { ok: true };
  }, [status, lastFetchedAt, refreshCoords, setStatus, setSortBy]);

  return { status, syncPermission, enableNearest };
}
