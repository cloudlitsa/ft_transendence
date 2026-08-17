// In-memory registry of connected WebSocket clients, keyed by userId.
// This is the heart of the module: "who is online, and how do I reach them."
import { WebSocket } from "ws";

// One user can have MULTIPLE sockets at once — two browser tabs, a laptop
// and a phone. If we stored a single socket per user, opening a second tab
// would silently orphan the first: it would stay open but never receive
// anything. A Set holds all of a user's live sockets; add/delete are O(1)
// and duplicates are impossible by definition.
const clients = new Map<string, Set<WebSocket>>();

export function addClient(userId: string, socket: WebSocket) {
  let set = clients.get(userId);
  if (!set) {
    set = new Set();
    clients.set(userId, set);
  }
  set.add(socket);
}

export function removeClient(userId: string, socket: WebSocket) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(socket);
  // Remove the empty Set so the Map only ever contains online users.
  // This is what makes presence (TRAN-27) trivial later: online means
  // "has an entry in this Map" — no extra bookkeeping.
  if (set.size === 0) clients.delete(userId);
}

export function isOnline(userId: string): boolean {
  return clients.has(userId);
}

// Send a payload to specific users only — NOT to everyone connected.
// This is the "efficient message broadcasting" the subject asks for:
// an alert goes to the sender's friends, not to every socket we hold.
export function broadcastToUsers(userIds: string[], payload: unknown) {
  const message = JSON.stringify(payload); // serialize ONCE, send many times
  for (const userId of userIds) {
    const set = clients.get(userId);
    if (!set) continue; // user offline — nothing to do, not an error
    for (const socket of set) {
      // readyState guard: a socket can be half-closed (CLOSING) while
      // still in the registry for a few ms. Sending to it throws.
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }
}