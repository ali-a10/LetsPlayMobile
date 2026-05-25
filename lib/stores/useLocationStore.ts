import { create } from 'zustand';

/** OS foreground-location permission status, mirrored from expo-location. */
export type LocationStatus = 'undetermined' | 'granted' | 'denied';

interface LocationState {
  status: LocationStatus;
  latitude: number | null;
  longitude: number | null;
  /** Epoch ms of the last coordinate fetch, used as a freshness TTL. */
  lastFetchedAt: number | null;
  setStatus: (status: LocationStatus) => void;
  setCoords: (latitude: number, longitude: number) => void;
  clear: () => void;
}

const initialState = {
  status: 'undetermined' as LocationStatus,
  latitude: null as number | null,
  longitude: null as number | null,
  lastFetchedAt: null as number | null,
};

/**
 * In-memory mirror of the device's foreground-location permission and last-known
 * coordinates; not persisted, so it re-syncs from the OS each launch.
 */
export const useLocationStore = create<LocationState>((set) => ({
  ...initialState,
  /** Records the latest OS permission status for foreground location. */
  setStatus: (status) => set({ status }),
  /** Stores fetched coordinates and stamps the fetch time for freshness checks. */
  setCoords: (latitude, longitude) =>
    set({ latitude, longitude, lastFetchedAt: Date.now() }),
  /** Resets the store to its initial empty state. */
  clear: () => set(initialState),
}));
