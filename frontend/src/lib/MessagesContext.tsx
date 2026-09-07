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
  removeAttachment: (a: { id: string; alertId: string }) => void;  // called by the socket
  closeOpenAlert: (alertId: string) => void;      // called by the socket
  closedAlertId: string | null;   // set when the open conversation's alert closes
}

const MessagesContext = createContext<MessagesContextValue | null>(null);

export function MessagesProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // A ref, NOT state, on purpose. The socket's message handler is created once
  // and would capture a stale value of any normal variable. A ref is a stable
  // box whose .current is always current — and changing it doesn't re-run the
  // socket effect. (Same stale-closure fix useAlertSocket uses for toastRef.)
  const openAlertIdRef = useRef<string | null>(null);

  // The sender closed the check-in this conversation hangs off.
  //
  // ConversationPage owns the alert object — it fetches it by id — so this is
  // the socket's only route to that state, exactly as addIncomingMessage is
  // its only route to the message list. State rather than a ref, because the
  // page has to re-render when it changes.
  const [closedAlertId, setClosedAlertId] = useState<string | null>(null);

  const setOpenAlertId = useCallback((id: string | null) => {
    openAlertIdRef.current = id;
    // A close belongs to the conversation it arrived for. Left set, it would
    // mark the NEXT conversation closed the moment it opened.
    setClosedAlertId(null);
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

  // A sender removed one of their attachments. Mark it, don't drop it.
  //
  // Setting deletedAt produces exactly the state a page reload would produce,
  // so a live delete and a refreshed one look identical. Filtering the
  // attachment out of the array instead would make the bubble look like it
  // never had an image — the thing the soft delete exists to prevent.
  //
  // The timestamp is generated here rather than sent by the server, because
  // nothing displays it: rendering only asks whether deletedAt is set at all.
  // If a "removed at 14:32" label is ever wanted, the broadcast should carry
  // the real value instead.
  const removeAttachment = useCallback(({ id, alertId }: { id: string; alertId: string }) => {
    // Same guard as addIncomingMessage: a deletion in a conversation that
    // isn't on screen has nothing to update.
    if (alertId !== openAlertIdRef.current) return;

    setMessages((cur) => {
      let changed = false;
      const next = cur.map((m) => {
        // Skip messages that don't hold this attachment, and ones where it is
        // already marked — a delete can arrive twice (the socket does not skip
        // the deleter, so their own tab hears it as well as getting the
        // response).
        if (!m.attachments.some((a) => a.id === id && !a.deletedAt)) return m;
        changed = true;
        // New objects the whole way down. Mutating m.attachments in place
        // would leave React comparing identical references and re-rendering
        // nothing.
        return {
          ...m,
          attachments: m.attachments.map((a) =>
            a.id === id ? { ...a, deletedAt: new Date().toISOString() } : a,
          ),
        };
      });
      // Returning the original array when nothing matched avoids a pointless
      // re-render of the whole list.
      return changed ? next : cur;
    });
  }, []);

  // Same guard as addIncomingMessage and removeAttachment: a close in a
  // conversation nobody is looking at has nothing on screen to update. The
  // alerts list handles that case separately, from the same event.
  //
  // Only the id is stored, not a status string — the page turns it into
  // status: "closed", which is exactly the state a reload would produce.
  // Same reasoning as the synthesised deletedAt above.
  const closeOpenAlert = useCallback((alertId: string) => {
    if (alertId !== openAlertIdRef.current) return;
    setClosedAlertId(alertId);
  }, []);

  const value = useMemo(
    () => ({
      messages,
      setMessages,
      setOpenAlertId,
      addIncomingMessage,
      removeAttachment,
      closeOpenAlert,
      closedAlertId,
    }),
    [messages, setOpenAlertId, addIncomingMessage, removeAttachment, closeOpenAlert, closedAlertId],
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

