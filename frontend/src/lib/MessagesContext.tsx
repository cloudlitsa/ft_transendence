// Shares the open conversation's message list between two parts of the app
// that can't otherwise reach each other:
//   - ConversationPage fetches the messages and renders them.
//   - useAlertSocket (at App level) hears "message:new" from the server.
// Without something in the middle, the socket has no way to hand a live
// message to the page. This is the exact sibling of AlertsContext.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ChatMessage } from "./chat";

interface MessagesContextValue {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setOpenAlertId: (id: string | null) => void;   // which conversation is on screen
  addIncomingMessage: (m: ChatMessage) => void;   // called by the socket
}

const MessagesContext = createContext<MessagesContextValue | null>(null);

export function MessagesProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // A ref, NOT state, on purpose. The socket's message handler is created once
  // and would capture a stale value of any normal variable. A ref is a stable
  // box whose .current is always current — and changing it doesn't re-run the
  // socket effect. (Same stale-closure fix useAlertSocket uses for toastRef.)
  const openAlertIdRef = useRef<string | null>(null);
  const setOpenAlertId = useCallback((id: string | null) => {
    openAlertIdRef.current = id;
  }, []);

  const addIncomingMessage = useCallback((m: ChatMessage) => {
  // A message with no alertId can't be matched against the open conversation,
  // so it would be dropped by the check below — silently, and indistinguishably
  // from the legitimate case of a message for a conversation we're not viewing.
  // Loud, because it always means a bug: a stale backend build was sending
  // message:new without alertId and live chat quietly stopped working.
  if (!m.alertId) {
    console.warn("message:new missing alertId", m);
    return;
  }
  if (m.alertId !== openAlertIdRef.current) return;
  setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
}, []);

  const value = useMemo(
    () => ({ messages, setMessages, setOpenAlertId, addIncomingMessage }),
    [messages, setOpenAlertId, addIncomingMessage],
  );

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages(): MessagesContextValue {
  const ctx = useContext(MessagesContext);
  if (ctx === null) {
    throw new Error("useMessages must be used inside a MessagesProvider");
  }
  return ctx;
}

