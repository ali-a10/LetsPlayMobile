// Sentry's metro wrapper adds debug-ID injection and sourcemap support
// on top of Expo's default config.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
