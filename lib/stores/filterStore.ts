import { create } from 'zustand';

interface FilterState {
  sport: string | null;
  date: string | null;
  setSport: (sport: string | null) => void;
  setDate: (date: string | null) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  sport: null,
  date: null,
  setSport: (sport) => set({ sport }),
  setDate: (date) => set({ date }),
  reset: () => set({ sport: null, date: null }),
}));
