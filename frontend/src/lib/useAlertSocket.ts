// Opens the app's WebSocket connection and turns incoming server messages
// into UI feedback. Mounted once, high in the tree (App.tsx), so the socket
// survives route changes — a connection per page would drop and reopen every
// time the user navigates.
//
// The server pushes; this hook never polls. See docs/websocket-demo.md for
// how to verify the whole path end to end.

import { useEffect, useRef } from "react";
import { useToast } from "../components/ToastProvider.tsx";

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
  | { type: "alert:new"; alert: IncomingAlert };

// The alertType enum values are database identifiers, not English. Map them
// once here rather than scattering the wording through components.
const ALERT_WORDING: Record<IncomingAlert["alertType"], string> = {
  need_chat: "needs a chat",
  not_okay: "is not okay",
  reach_out: "would like someone to reach out",
};

export function useAlertSocket() {
    const toast = useToast();
  // The effect must not depend on `toast`: ToastProvider hands out a new
  // context object whenever a toast appears or dismisses, which would tear
  // down and rebuild the socket every few seconds. A ref gives the effect a
  // stable handle that always points at the current toast API.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    // Derive the protocol from the page rather than hardcoding "ws://", so
    // this upgrades itself to wss:// the day the reverse proxy lands.
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

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
          break;
        }
      }
    };

    socket.onerror = () => {
      // Don't toast this. A failed connection is not something the user did,
      // and an error toast on every backend restart in dev is just noise.
      console.warn("ws: connection error");
    };

    // Cleanup runs when the component unmounts. Without it the socket stays
    // open, the server keeps it in its registry, and the user looks online
    // after they've gone.
    return () => {
      socket.close();
    };
  }, []); // Empty dependency array: run once on mount, never again.
}
