const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for getDevServer error
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Disable development server features that might cause conflicts
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Skip development server features in production-like environments
      if (req.url && req.url.includes('getDevServer')) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
