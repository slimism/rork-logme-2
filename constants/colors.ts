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
  get card() { return isDark() ? '#1a1a1a' : '#ffffff'; },
  get cardSecondary() { return isDark() ? '#151515' : '#f9f9f9'; },
  get text() { return isDark() ? '#f2f2f2' : '#333333'; },
  get subtext() { return isDark() ? '#b0b0b0' : '#666666'; },
  get border() { return isDark() ? '#2a2a2a' : '#e0e0e0'; },
  get success() { return '#2ecc71'; },
  get error() { return '#e74c3c'; },
  get warning() { return '#f39c12'; },
  get disabled() { return isDark() ? '#3a3a3a' : '#bdc3c7'; },
  get inputBackground() { return isDark() ? '#2a2a2a' : '#ffffff'; },
  get searchBackground() { return isDark() ? '#2a2a2a' : '#f5f5f5'; },
  get modalOverlay() { return 'rgba(0, 0, 0, 0.5)'; },
  get modalBackground() { return isDark() ? '#1a1a1a' : '#ffffff'; },
} as const;

// Hook to get reactive colors that update when theme changes
export const useColors = () => {
  const { darkMode } = useThemeStore();
  
  return {
    primary: '#3498db',
    secondary: '#f8a5c2',
    background: darkMode ? '#0b0b0b' : '#ffffff',
    card: darkMode ? '#1a1a1a' : '#ffffff',
    cardSecondary: darkMode ? '#151515' : '#f9f9f9',
    text: darkMode ? '#f2f2f2' : '#333333',
    subtext: darkMode ? '#b0b0b0' : '#666666',
    border: darkMode ? '#2a2a2a' : '#e0e0e0',
    success: '#2ecc71',
    error: '#e74c3c',
    warning: '#f39c12',
    disabled: darkMode ? '#3a3a3a' : '#bdc3c7',
    inputBackground: darkMode ? '#2a2a2a' : '#ffffff',
    searchBackground: darkMode ? '#2a2a2a' : '#f5f5f5',
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: darkMode ? '#1a1a1a' : '#ffffff',
  };
};

export { colors };
export default colors;