// Custom entry point that loads polyfills BEFORE expo-router
// This ensures React.use is polyfilled before any expo-router code runs

// Import polyfills first - this is a side-effect import that patches React
import './polyfills';

// Now import expo-router entry - this will use the polyfilled React
import 'expo-router/entry';
