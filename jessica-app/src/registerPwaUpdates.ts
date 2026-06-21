import { registerSW } from "virtual:pwa-register";

// Keeps the installed app current without a manual close-and-reopen.
// With registerType 'autoUpdate', registerSW applies a new service worker and
// reloads the page on its own once one is found — we just need to ask it to
// look for updates more often than the default once-per-page-load.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly while left open

export function registerPwaUpdates() {
  if (!("serviceWorker" in navigator)) return;

  registerSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = () => {
        if (navigator.onLine) void registration.update();
      };

      // Check periodically while the app stays open...
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

      // ...and immediately whenever the app is brought back to the foreground,
      // so switching back to it picks up a freshly deployed version.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
    },
  });
}
