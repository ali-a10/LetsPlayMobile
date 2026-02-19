import { create } from 'zustand';

interface FilterState {
  sport: string | null;
  date: string | null;
  searchText: string;
  setSport: (sport: string | null) => void;
  setDate: (date: string | null) => void;
  setSearchText: (text: string) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  sport: null,
  date: null,
  searchText: '',
  setSport: (sport) => set({ sport }),
  setDate: (date) => set({ date }),
  setSearchText: (searchText) => set({ searchText }),
  reset: () => set({ sport: null, date: null, searchText: '' }),
}));
