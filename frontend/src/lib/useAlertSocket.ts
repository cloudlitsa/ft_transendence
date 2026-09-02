// Opens the app's WebSocket connection and turns incoming server messages
// into UI feedback. Mounted once, high in the tree (App.tsx), so the socket
// survives route changes — a connection per page would drop and reopen every
// time the user navigates.
//
// The server pushes; this hook never polls. See docs/websocket-demo.md for
// how to verify the whole path end to end.

import { useEffect, useRef } from "react";
import { useToast } from "../components/ToastProvider.tsx";
import { useAuth } from "./AuthContext.tsx";
import { useAlerts } from "./AlertsContext.tsx";
import { usePresence } from "./PresenceContext.tsx";

import { useMessages } from "./MessagesContext.tsx";
import type { ChatMessage } from "./chat";

// Shape of what the server sends. Kept narrow on purpose: if the backend
// starts sending a new message type, TypeScript won't pretend to know about
// it and the switch below will fall through harmlessly.
type AlertSender = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

type IncomingAlert = {
  id: string;
  alertType: "need_chat" | "not_okay" | "reach_out";
  note: string | null;
  status: string;
  createdAt: string;
  sender: AlertSender;
};

type ServerMessage =
  | { type: "connected" }
  | { type: "alert:new"; alert: IncomingAlert }
  | { type: "presence"; userId: string; online: boolean }
  | { type: "message:new"; message: ChatMessage }
  | { type: "alert:ack"; alertId: string; acknowledgement: { acknowledgedAt: string; user: AlertSender } };
  
// The alertType enum values are database identifiers, not English. Map them
// once here rather than scattering the wording through components.
const ALERT_WORDING: Record<IncomingAlert["alertType"], string> = {
  need_chat: "needs a chat",
  not_okay: "is not okay",
  reach_out: "would like someone to reach out",
};

// Reconnection: we chose the raw WebSocket API over Socket.IO, which means
// reconnecting is ours to write. Back off exponentially so a server that's
// down doesn't get hammered by every open tab, and give up after a while
// rather than retrying forever — logged out means no socket at all
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const MAX_ATTEMPTS = 8;

export function useAlertSocket() {
  const { user } = useAuth();
  const { setFriendsAlerts, bumpAck } = useAlerts();
  const { setPresence } = usePresence();
  const { addIncomingMessage } = useMessages();
  const toast = useToast();

  // The effect must not depend on `toast`: ToastProvider hands out a new
  // context object whenever a toast appears or dismisses, which would tear
  // down and rebuild the socket every few seconds. A ref gives the effect a
  // stable handle that always points at the current toast API.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    // No session, no socket. The server refuses the upgrade for an
    // unauthenticated client anyway, but the point is stronger than that:
    // a socket that outlives logout keeps delivering a stranger's check-ins
    // to whoever sits down at the machine next.
    if (!user) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    // Set by cleanup. Distinguishes "we closed this on purpose" from "the
    // connection dropped" — without it, unmounting would trigger a reconnect
    // to a socket nobody is listening to.
    let disposed = false;

    function connect() {
      // Derive the protocol from the page rather than hardcoding "ws://", so
      // this upgrades itself to wss:// the day the reverse proxy lands.
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

      socket.onopen = () => {
        // Back to zero, so a later drop starts from a short delay again
        // rather than inheriting the previous outage's backoff.
        attempts = 0;
      };

      socket.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data);
        } catch {
          // Malformed frame — ignore it rather than crashing the app.
          console.warn("ws: could not parse message", event.data);
          return;
        }

        switch (message.type) {
          case "connected":
            // Handshake confirmation. Nothing for the user to see.
            break;

          case "alert:new": {
            const { sender, alertType, note } = message.alert;
            const wording = ALERT_WORDING[alertType] ?? "sent a check-in";
            toastRef.current.info(
              note
                ? `${sender.displayName} ${wording}: ${note}`
                : `${sender.displayName} ${wording}`,
            );
            // Add it to the shared list so /alerts updates without a refresh.
            // The function form gives us the CURRENT list — reading friendsAlerts
            // from the closure would give whatever it was when this effect ran.
            setFriendsAlerts((current) => {
              // A fetch and a push can deliver the same alert. Adding it twice
              // renders duplicate rows with duplicate React keys.
              if (current.some((a) => a.id === message.alert.id)) return current;
              // A NEW array — current.push() mutates in place, React compares by
              // identity and would see nothing changed. Newest first.
              return [{ ...message.alert, acknowledgements: [] }, ...current];
            });
            break;
          }
          case "message:new":
            addIncomingMessage(message.message);
            break;
          case "presence":
            setPresence(message.userId, message.online);
            break;
          case "alert:ack": {
            toastRef.current.success(
              `${message.acknowledgement.user.displayName} has seen your check-in`,
            );
            bumpAck();
            break;
          }
        }
      };

      socket.onerror = () => {
        // Don't toast this. A failed connection is not something the user did,
        // and an error toast on every backend restart in dev is just noise.
        // The close handler below decides whether to retry.
        console.warn("ws: connection error");
      };

      socket.onclose = () => {
        if (disposed) return; // we closed it — nothing to recover from

        if (attempts >= MAX_ATTEMPTS) {
          // Worth telling the user. Silently losing real-time delivery means
          // a friend could send a check-in and they'd never see it.
          console.warn("ws: giving up after", attempts, "attempts");
          toastRef.current.error(
            "Lost the live connection. Refresh the page to reconnect.",
          );
          return;
        }

        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** attempts,
          RECONNECT_MAX_MS,
        );
        attempts += 1;
        console.warn(`ws: reconnecting in ${delay}ms (attempt ${attempts})`);
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    // Cleanup runs when the component unmounts. Without it the socket stays
    // open, the server keeps it in its registry, and the user looks online
    // after they've gone. Clearing the timer matters just as much: a pending
    // reconnect would otherwise fire after unmount and open a socket that
    // nothing ever closes.
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [user?.id]); // user.id is stable across re-renders, so this effect runs once per login/logout
}
