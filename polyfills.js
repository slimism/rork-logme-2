// Polyfill for React.use hook (React 19 feature) for React 18 compatibility
// This must be imported before any code that uses React.use
// This polyfill patches React at the module level to ensure compatibility

import * as React from 'react';
import ReactDefault from 'react';

// Create a polyfill function that mimics React.use behavior
const usePolyfill = function use(promise) {
  // React.use is used for unwrapping promises and context values
  // In React 18, we provide a simple fallback
  if (promise && typeof promise === 'object') {
    // If it's a promise-like object, throw it to trigger Suspense
    if (typeof promise.then === 'function') {
      throw promise;
    }
    // If it's a context value or other object, return it
    return promise;
  }
  // For primitive values, return as-is
  return promise;
};

// Apply polyfill immediately to all React exports
// This patches React before any other code can use it
try {
  // Patch the namespace export (import * as React)
  if (!React.use || typeof React.use !== 'function') {
    try {
      Object.defineProperty(React, 'use', {
        value: usePolyfill,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch (e) {
      // Fallback if defineProperty fails
      React.use = usePolyfill;
    }
  }

  // Patch the default export (import React)
  if (ReactDefault && (!ReactDefault.use || typeof ReactDefault.use !== 'function')) {
    try {
      Object.defineProperty(ReactDefault, 'use', {
        value: usePolyfill,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch (e) {
      ReactDefault.use = usePolyfill;
    }
  }

  // Also ensure React.default is patched if it exists
  if (React.default && (!React.default.use || typeof React.default.use !== 'function')) {
    try {
      Object.defineProperty(React.default, 'use', {
        value: usePolyfill,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch (e) {
      React.default.use = usePolyfill;
    }
  }

  // Patch the actual module exports by accessing the module cache
  // This ensures all future imports of React will have the polyfill
  if (typeof require !== 'undefined' && require.cache) {
    try {
      const reactModulePath = require.resolve('react');
      const reactModule = require.cache[reactModulePath];
      if (reactModule && reactModule.exports) {
        const exports = reactModule.exports;
        if (exports && (!exports.use || typeof exports.use !== 'function')) {
          exports.use = usePolyfill;
        }
        if (exports && exports.default && (!exports.default.use || typeof exports.default.use !== 'function')) {
          exports.default.use = usePolyfill;
        }
      }
    } catch (e) {
      // Ignore errors in module cache patching
    }
  }
} catch (error) {
  console.warn('Failed to polyfill React.use:', error);
}
