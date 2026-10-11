import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Appearance = 'system' | 'light' | 'dark';

type PrefsState = {
  appearance: Appearance;
  restSeconds: number;
  restAlert: boolean;
  tutorialSeen: boolean;
  setAppearance: (appearance: Appearance) => void;
  setRestSeconds: (restSeconds: number) => void;
  setRestAlert: (restAlert: boolean) => void;
  setTutorialSeen: (tutorialSeen: boolean) => void;
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      appearance: 'system',
      restSeconds: 90,
      restAlert: false,
      tutorialSeen: false,
      setAppearance: (appearance) => set({ appearance }),
      setRestSeconds: (restSeconds) => set({ restSeconds }),
      setRestAlert: (restAlert) => set({ restAlert }),
      setTutorialSeen: (tutorialSeen) => set({ tutorialSeen }),
    }),
    {
      name: 'setwise.prefs',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
