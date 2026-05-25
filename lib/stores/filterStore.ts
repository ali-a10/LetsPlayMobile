import { create } from 'zustand';

export type SortBy = 'soonest' | 'nearest';

interface FilterState {
  sport: string | null;
  /** Selected calendar day to filter by, stored as a 'YYYY-MM-DD' string. */
  date: string | null;
  searchText: string;
  freeOnly: boolean;
  hasSpots: boolean;
  sortBy: SortBy;
  setSport: (sport: string | null) => void;
  setDate: (date: string | null) => void;
  setSearchText: (text: string) => void;
  setFreeOnly: (freeOnly: boolean) => void;
  setHasSpots: (hasSpots: boolean) => void;
  setSortBy: (sortBy: SortBy) => void;
  reset: () => void;
}

const initialState = {
  sport: null as string | null,
  date: null as string | null,
  searchText: '',
  freeOnly: false,
  hasSpots: false,
  sortBy: 'soonest' as SortBy,
};

export const useFilterStore = create<FilterState>((set) => ({
  ...initialState,
  /** Sets the active sport filter (null = all sports). */
  setSport: (sport) => set({ sport }),
  /** Sets the selected calendar day to filter by (null = any day). */
  setDate: (date) => set({ date }),
  /** Sets the free-text search query. */
  setSearchText: (searchText) => set({ searchText }),
  /** Toggles whether only free (non-paid) events are shown. */
  setFreeOnly: (freeOnly) => set({ freeOnly }),
  /** Toggles whether only events with at least one open spot are shown. */
  setHasSpots: (hasSpots) => set({ hasSpots }),
  /** Sets the active sort order ('soonest' by date, 'nearest' by distance). */
  setSortBy: (sortBy) => set({ sortBy }),
  /** Clears all filters and resets the sort back to 'soonest'. */
  reset: () => set(initialState),
}));
