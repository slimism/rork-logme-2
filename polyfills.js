// Polyfill for React.use hook (React 19 feature) for React 18 compatibility
// This MUST run synchronously before any other code loads
// This polyfill patches React at the module level to ensure compatibility

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

// Immediately patch React using require (runs synchronously before ES module imports)
// This IIFE runs immediately when the module loads
(function() {
  'use strict';
  
  try {
    // Use require to get React module synchronously (before ES module imports)
    if (typeof require !== 'undefined') {
      const React = require('react');
      
      // Patch all possible React exports
      if (React && (!React.use || typeof React.use !== 'function')) {
        React.use = usePolyfill;
      }
      
      if (React && React.default && (!React.default.use || typeof React.default.use !== 'function')) {
        React.default.use = usePolyfill;
      }
      
      // Patch module cache for future imports
      if (require.cache) {
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
          // Ignore module cache errors
        }
      }
    }
  } catch (error) {
    console.warn('Failed to polyfill React.use with require:', error);
  }
})();

// Also patch when imported via ES modules (for completeness)
// This ensures the polyfill works in both CommonJS and ES module contexts
import * as React from 'react';
import ReactDefault from 'react';

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
} catch (error) {
  console.warn('Failed to polyfill React.use in ES module context:', error);
}
