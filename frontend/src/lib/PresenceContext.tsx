import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// A live set of user ids currently online. Fed by presence messages from the
// WebSocket; read by any component that shows online status.
interface PresenceApi {
  onlineIds: Set<string>;
  setPresence: (userId: string, online: boolean) => void;
  seed: (ids: string[]) => void; // initialise from a snapshot (e.g. the friends list)
}

const PresenceContext = createContext<PresenceApi | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const setPresence = useCallback((userId: string, online: boolean) => {
    setOnlineIds((prev) => {
      const next = new Set(prev);        // new Set so React sees a change
      if (online) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, []);
  const seed = useCallback((ids: string[]) => {
    setOnlineIds(new Set(ids));
  }, []);
    return (
    <PresenceContext.Provider value={{ onlineIds, setPresence, seed }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error("usePresence must be used inside <PresenceProvider>");
  return ctx;
}
