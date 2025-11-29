import React from "react";
// Polyfill for React's use() hook which is needed for Zustand 5.x but not available in React 18
// This polyfill provides basic Promise handling for Zustand's middleware

// Try to add polyfill to React module
try {
  const React = require('react');
  if (!React.use) {
    React.use = function use(promise) {
      if (promise && typeof promise.then === 'function') {
        // For promises, we throw to let React Suspense handle it
        throw promise;
      }
      // For context-like usage, return the value directly
      return promise;
    };
  }
} catch (_e) {
  // React not yet loaded, that's okay
}
