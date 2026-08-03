import { useEffect, useState } from "react";

// OfflineBanner: a small bar shown at the top of the app whenever the browser
// loses its network connection. The PWA service worker still serves the cached
// app offline, so the app keeps working — this banner just tells the user that
// live data (alerts, friends, chat) won't update until they're back online.
export default function OfflineBanner() {
  // navigator.onLine is the browser's built-in flag: true when connected,
  // false when offline. We use it as the starting value so the banner is
  // correct on first render (e.g. if the app is opened while already offline).
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    // The browser fires "online" / "offline" events on the window whenever
    // connectivity changes. We update our state in response.
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup: React runs this when the component is removed. Every listener we
    // add must be removed, or we'd leak listeners on each mount/unmount.
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []); // empty deps: set up the listeners once, when the component mounts.

  // Online: render nothing (the banner is invisible).
  if (online) return null;

  // Offline: show the banner.
  return (
    <div
      role="status" // marks this as a status message for assistive tech
      aria-live="polite" // screen readers announce it without interrupting
      style={{
        background: "#b91c1c",
        color: "white",
        textAlign: "center",
        padding: "0.5rem 1rem",
        fontSize: "0.9rem",
      }}
    >
      You're offline — showing the last loaded version. Some features are
      unavailable until you reconnect.
    </div>
  );
}
