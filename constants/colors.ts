import { useThemeStore } from '@/store/themeStore';

const isDark = () => {
  try {
    return useThemeStore.getState().darkMode ?? false;
  } catch (e) {
    return false;
  }
};

const colors = {
  get primary() { return '#3498db'; },
  get secondary() { return '#f8a5c2'; },
  get background() { return isDark() ? '#0b0b0b' : '#ffffff'; },
  get card() { return isDark() ? '#151515' : '#f9f9f9'; },
  get text() { return isDark() ? '#f2f2f2' : '#333333'; },
  get subtext() { return isDark() ? '#b0b0b0' : '#666666'; },
  get border() { return isDark() ? '#2a2a2a' : '#e0e0e0'; },
  get success() { return '#2ecc71'; },
  get error() { return '#e74c3c'; },
  get warning() { return '#f39c12'; },
  get disabled() { return isDark() ? '#3a3a3a' : '#bdc3c7'; },
} as const;

export { colors };
export default colors;