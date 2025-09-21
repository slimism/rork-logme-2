import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeState {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      darkMode: false,
      setDarkMode: (value: boolean) => {
        console.log('[ThemeStore] setDarkMode', value);
        set({ darkMode: value });
      },
      toggleDarkMode: () => {
        const next = !get().darkMode;
        console.log('[ThemeStore] toggleDarkMode ->', next);
        set({ darkMode: next });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
