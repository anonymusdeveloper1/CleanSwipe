/**
 * Expo Go demo stub for `react-native-background-actions`.
 *
 * Third-party NATIVE module absent from the Expo Go runtime. Metro aliases this
 * stub when EXPO_PUBLIC_EXPO_GO_DEMO=1 (see metro.config.js). There is no real
 * Android foreground service in Expo Go, so `start` simply runs the task INLINE
 * as plain foreground JS — which is exactly the documented graceful-degradation
 * path, so the Smart Clean scan still runs (it just isn't a true background
 * service). `stop`/`updateNotification` no-op; `isRunning` is tracked so the
 * worker wrappers' `isRunning()` guards behave correctly.
 *
 * The worker wrappers import the default export and pass a task callback to
 * `start`; that callback resolves/rejects their outer promise, so running it
 * inline preserves their contract.
 */
let running = false;

const BackgroundService = {
  isRunning() {
    return running;
  },
  async start(task, options) {
    running = true;
    try {
      if (typeof task === "function") {
        await task((options && options.parameters) || undefined);
      }
    } finally {
      running = false;
    }
  },
  async stop() {
    running = false;
  },
  async updateNotification() {
    return undefined;
  }
};

module.exports = BackgroundService;
