import { create } from 'zustand';

/** Stores onboarding form data across the 3-step signup flow. */
interface OnboardingState {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  gender: string | null;
  favouriteSports: string[];
  aboutMe: string;
  avatarUrl: string | null;
  setName: (firstName: string, lastName: string) => void;
  setDetails: (phone: string, dateOfBirth: string, gender: string) => void;
  setProfile: (
    favouriteSports: string[],
    aboutMe: string,
    avatarUrl: string | null
  ) => void;
  reset: () => void;
}

const initialState = {
  firstName: '',
  lastName: '',
  phone: '',
  dateOfBirth: '',
  gender: null as string | null,
  favouriteSports: [] as string[],
  aboutMe: '',
  avatarUrl: null as string | null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setName: (firstName, lastName) => set({ firstName, lastName }),
  setDetails: (phone, dateOfBirth, gender) => set({ phone, dateOfBirth, gender }),
  setProfile: (favouriteSports, aboutMe, avatarUrl) =>
    set({ favouriteSports, aboutMe, avatarUrl }),
  reset: () => set(initialState),
}));
