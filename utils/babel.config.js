module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            'react-native-worklets/plugin', // fix for reanimated plugin warning
            // add other plugins here if needed
        ],
    };
};
