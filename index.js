// Custom entry point that loads polyfills BEFORE expo-router
// This ensures React.use is polyfilled before any expo-router code runs

// Import polyfills first - this patches React.use synchronously
import './polyfills';

// Now import expo-router entry which will use the polyfilled React
import 'expo-router/entry';

