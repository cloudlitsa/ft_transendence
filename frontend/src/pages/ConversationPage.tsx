import { useEffect, useState, useRef, type FormEvent } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.tsx";
import Spinner from "../components/ui/Spinner";
import type { ChatMessage, ChatSender  } from "../lib/chat";
import { useMessages } from "../lib/MessagesContext.tsx";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";

// TODO(TRAN-22): TEMPORARY mock data for building the UI before the backend
// endpoints exist. DELETE this whole block once GET /alerts/:id/messages works.
// The shape matches lib/chat.ts exactly, so swapping to the real fetch is easy.
const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: "mock-1",
    content: "Hey Sara, I saw your check-in. You okay?",
    createdAt: "2026-08-24T15:14:32.000Z",
    alertId: "mock-alert",
    sender: { id: "tom-uuid", displayName: "Tom", avatarUrl: null },
  },
  {
    id: "mock-2",
    content: "Rough day, honestly. Could use a chat.",
    createdAt: "2026-08-24T15:15:10.000Z",
    alertId: "mock-alert",
    sender: { id: "me-uuid", displayName: "Me", avatarUrl: null },
  },
  {
    id: "mock-3",
    content: "Calling you now.",
    createdAt: "2026-08-24T15:16:02.000Z",
    alertId: "mock-alert",
    sender: { id: "tom-uuid", displayName: "Tom", avatarUrl: null },
  },
];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}


// Shows the user's photo, or coloured initials when they have none.
// avatarUrl is nullable (see lib/chat.ts) — never render a broken <img>.
function Avatar({ user }: { user: ChatSender }) {
  const initials = user.displayName.slice(0, 2).toUpperCase();
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
  ) : (
    <span className="size-7 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-semibold">
      {initials}
    </span>
  );
}

interface HeaderAlert {
  note?: string | null;
  status?: string;
  sender?: { displayName: string; avatarUrl: string | null };
}

export default function ConversationPage() {
  const { id } = useParams();   // reads the ":id" out of the URL

  // TODO(TRAN-22): Option A — the alert object is passed via <Link state> from
  // AlertsPage. It's undefined on a hard refresh / direct URL (state is lost),
  // and the header simply hides in that case.
  const location = useLocation();
  const alert = (location.state as { alert?: HeaderAlert } | null)?.alert;

  /* ---- Option B (use once GET /alerts/:id exists; delete Option A above) ----
  // Survives refresh because it re-fetches instead of relying on nav state.
  const [alert, setAlert] = useState<HeaderAlert | undefined>();
  useEffect(() => {
    if (!id) return;
    api.get<{ alert: HeaderAlert }>(`/alerts/${id}`)
      .then((res) => setAlert(res.alert))
      .catch(() => setAlert(undefined));   // header just hides on failure
  }, [id]);
  --------------------------------------------------------------------------- */

  const { user } = useAuth();      // to tell my messages from everyone else's

  const { messages, setMessages, setOpenAlertId } = useMessages();
  const [loading, setLoading] = useState(true);
  
      // TODO(TRAN-22): setError is used by the real fetch (currently commented).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");      // what's currently typed in the box
  const [sending, setSending] = useState(false); // true while a send is in flight
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message whenever the list changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load the conversation's messages.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    
    setOpenAlertId(id);          // ← tell the socket "this conversation is on screen"
    
    // TODO(TRAN-22): remove this mock branch and enable the real fetch below
    // once the backend exists. Verify the shape with:
    //   curl -i -b /tmp/me1.txt http://localhost:5173/api/alerts/<id>/messages
    if (!cancelled) {
      setMessages(MOCK_MESSAGES);
      setLoading(false);
    }

    /* ---- REAL VERSION (uncomment when backend is ready, delete the mock above) ----
    (async () => {
      try {
        const res = await api.get<{ messages: ChatMessage[] }>(`/alerts/${id}/messages`);
        // TODO(TRAN-22): if backend returns a bare array, change to setMessages(res)
        if (!cancelled) setMessages(res.messages);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    ------------------------------------------------------------------------------- */

  return () => {
    cancelled = true;
    setOpenAlertId(null);      // ← no conversation open once we leave
    setMessages([]);           // ← clear so the next conversation starts fresh
  };
}, [id]);

  if (loading) {
    return (
      <main>
        <p role="status" aria-live="polite"><Spinner /> Loading conversation…</p>
      </main>
    );
  }

  function send(e: FormEvent) {
  e.preventDefault();               // stop the browser's default full-page form submit
  const content = draft.trim();     // trim FIRST — matches backend .trim().min(1)
  if (!content || sending) return;  // block empty messages and double-sends

  setSending(true);

  // TODO(TRAN-22): mock send — appends locally so the UI works without a backend.
  // Replace with the REAL VERSION below once POST /alerts/:id/messages exists.
  const mockMessage: ChatMessage = {
    id: `local-${Date.now()}`,          // fake unique id; the server will assign the real one
    content,
    createdAt: new Date().toISOString(),
    alertId: id ?? "mock-alert",
    sender: {
      id: user?.id ?? "me-uuid",        // my own id → renders as "mine" (right side)
      displayName: user?.displayName ?? "Me",
      avatarUrl: user?.avatarUrl ?? null,
    },
  };
  setMessages((cur) => [...cur, mockMessage]);
  setDraft("");                          // clear the box
  setSending(false);

  /* ---- REAL VERSION (add `async` to the function, then uncomment) ----
  // also add at the top:  import { useToast } from "../components/ToastProvider.tsx";
  // and inside the component:  const toast = useToast();
  try {
    const res = await api.post<{ message: ChatMessage }>(`/alerts/${id}/messages`, { content });
    // TODO(TRAN-22): if backend returns a bare object, change res.message → res
    setMessages((cur) =>
      cur.some((m) => m.id === res.message.id) ? cur : [...cur, res.message],
    );
    setDraft("");
  } catch (err) {
    toast.error((err as Error).message);   // 400 too long, 404 not allowed, etc.
  } finally {
    setSending(false);
  }
  ------------------------------------------------------------------- */
}

   if (error) {
    // A 404 here means "no such alert / not yours / not their friend" — all
    // identical on purpose (anti-probing). So we don't try to explain it.
    return (
      <main>
        <p role="alert">Couldn't open this conversation: {error}</p>
      </main>
    );
  }

return (
  <main className="flex flex-col gap-4">
    <h1 className="text-xl font-semibold">Conversation</h1>

    {alert && (
      <Card padding="sm" className="flex items-start gap-3 bg-alert-50">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-alert-700">
              {alert.sender ? `${alert.sender.displayName} sent a check-in` : "Your check-in"}
            </p>
            <Badge tone={alert.status === "closed" ? "neutral" : "success"}>
              {alert.status === "closed" ? "closed" : "active"}
            </Badge>
          </div>
          {alert.note && <p className="mt-1 font-medium text-ink">"{alert.note}"</p>}
        </div>
      </Card>
    )}

    <ul className="flex flex-col gap-3">
      {messages.map((m) => {
        const mine = m.sender.id === user?.id;
        return (
          <li key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
            <Avatar user={m.sender} />
            <div className="max-w-[80%]">
              {!mine && (
                <p className="text-xs font-semibold text-ink-muted mb-0.5">
                  {m.sender.displayName}
                </p>
              )}
              <div
                className={
                  mine
                    ? "bg-brand-500 text-white rounded-2xl rounded-br-sm px-3 py-2"
                    : "bg-surface-sunken border border-line rounded-2xl rounded-bl-sm px-3 py-2"
                }
              >
                {m.content}
              </div>
              <p className="text-xs text-ink-muted mt-0.5">{formatWhen(m.createdAt)}</p>
            </div>
          </li>
        );
      })}
      <div ref={bottomRef} />
    </ul>

    <form onSubmit={send} className="flex gap-2">
      <label htmlFor="msg" className="sr-only">Type a message</label>
      <textarea
        id="msg"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={2000}
        rows={1}
        placeholder="Type a message…"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); }
        }}
        className="flex-1 border border-line rounded-md px-3 py-2 bg-surface-sunken resize-none"
      />
      <Button type="submit" loading={sending} disabled={!draft.trim()}>Send</Button>
    </form>
  </main>
);
}

