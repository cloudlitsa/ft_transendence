// Shares the list of friends' active check-ins between two parts of the app
// that can't otherwise reach each other:
//
//   - AlertsPage fetches the list on mount and renders it.
//   - useAlertSocket lives at App level and hears alert:new from the server.
//
// Without something in the middle, the socket has no way to tell the page that
// something arrived, so the list only updated on a manual refresh — which
// doesn't demonstrate real-time delivery no matter what the backend does.
//
// Only friendsAlerts lives here. The rest of the page's state (myAlert,
// friendCount, loading) stays local to AlertsPage, because nothing outside the
// page needs to touch it.

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { FriendAlert } from "../pages/AlertsPage.tsx";

interface AlertsContextValue { // the value passed to the provider and returned by useAlerts()
  friendsAlerts: FriendAlert[]; // the list of friends' active check-ins, as fetched from the server
  setFriendsAlerts: React.Dispatch<React.SetStateAction<FriendAlert[]>>; // the setter returned by useState, so consumers can update the list when they receive a new alert from the socket
}

// null as the default so useAlerts() can tell "no provider above me" apart from
// "provider exists but the list is empty". Without it, a component used outside
// the provider would silently get undefined and fail somewhere confusing.
const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) { // children is the subtree that can read the context value, i.e. AlertsPage and its descendants
  const [friendsAlerts, setFriendsAlerts] = useState<FriendAlert[]>([]);

  // useMemo so this object is the same object between renders unless the list
  // actually changes. A fresh object every render would make every consumer
  // re-render, and any effect depending on it would tear down and rebuild —
  // the same trap that had the WebSocket reconnecting every three seconds.
  //
  // setFriendsAlerts is safe to leave out of the dependency array: React
  // guarantees the setter from useState is stable for the component's lifetime.
  const value = useMemo(
    () => ({ friendsAlerts, setFriendsAlerts }),
    [friendsAlerts],
  );

  return (
    <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
  );
}

export function useAlerts(): AlertsContextValue { // the hook that components call to read the context value. exported so AlertsPage can use it, and so useAlertSocket can use it to update the list when a new alert arrives.
  const context = useContext(AlertsContext);
  // Fail loudly and immediately rather than letting a component read undefined
  // and break somewhere unrelated. This error names the actual mistake.
  if (context === null) {
    throw new Error("useAlerts must be used inside an AlertsProvider");
  }
  return context;
}
