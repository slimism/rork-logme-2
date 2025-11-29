import * as React from 'react';

try {
  if (!React.use || typeof React.use !== 'function') {
    const usePolyfill = function use(promise) {
      if (promise && typeof promise === 'object' && typeof promise.then === 'function') {
        throw promise;
      }
      return promise;
    };
    
    React.use = usePolyfill;
    
    if (React.default && !React.default.use) {
      React.default.use = usePolyfill;
    }
  }
} catch (error) {
  console.warn('Failed to polyfill React.use:', error);
}
