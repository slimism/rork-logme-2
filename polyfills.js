// Polyfill for React's use() hook which is needed for Zustand 5.x but not available in React 18

// Import React first
import * as React from 'react';

// Add the use polyfill if it doesn't exist
if (!React.use) {
  React.use = function use(promise) {
    if (promise && typeof promise.then === 'function') {
      // For promises, throw to let React Suspense handle it
      throw promise;
    }
    // For context-like usage, return the value directly
    return promise;
  };
}

// Also patch the default export if it exists
if (React.default && !React.default.use) {
  React.default.use = React.use;
}
