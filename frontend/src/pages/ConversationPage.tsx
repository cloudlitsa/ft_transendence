import { useEffect, useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.tsx";
import Spinner from "../components/ui/Spinner";
import type { ChatMessage, ChatSender  } from "../lib/chat";
import { useMessages } from "../lib/MessagesContext.tsx";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { useToast } from "../components/ToastProvider.tsx";
import { api, uploadWithProgress } from "../lib/api";


function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}


// Client-side upload rules. These MIRROR the server (lib/fileStorage.ts) and
// do not replace it: file.type comes from the operating system's guess at the
// extension, and anyone can skip this page entirely with curl. The real check
// is the magic-byte test in storeFile, which answers 415.
//
// The job here is only to spare someone a slow upload of a file that was
// always going to be refused.
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");      // what's currently typed in the box
  const [sending, setSending] = useState(false); // true while a send is in flight
  const bottomRef = useRef<HTMLDivElement>(null);

  // The chosen image, before it is sent.
  //
  //   file      the File object itself, handed to FormData on submit
  //   preview   a blob: URL pointing at it, so it can be shown without upload
  //   progress  0-100 while an upload is in flight, null the rest of the time
  //   fileRef   a handle on the <input>, because a file input cannot be
  //             controlled by React state the way a text input can
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to the newest message whenever the list changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build a preview URL for the chosen file, and release it afterwards.
  //
  // createObjectURL hands back a "blob:" URL the browser keeps alive until the
  // page unloads or the URL is revoked. Choosing several images in a row
  // without revoking pins every one of them in memory, so the cleanup function
  // returned below matters — React runs it before the next effect and on
  // unmount.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Load the conversation's messages.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    
    setOpenAlertId(id);          // ← tell the socket "this conversation is on screen"

    (async () => {
      try {
        const res = await api.get<{ messages: ChatMessage[] }>(`/alerts/${id}/messages`);
        if (!cancelled) setMessages(res.messages);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

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

  // Forget the chosen file. Clearing fileRef.current.value matters: a file
  // input is not controlled by React, and without the reset, picking the SAME
  // file again fires no change event and appears to do nothing.
  function clearFile() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    if (!chosen) return;

    if (!ACCEPTED_TYPES.includes(chosen.type)) {
      toast.error("Images only — jpeg, png or webp.");
      clearFile();
      return;
    }
    if (chosen.size > MAX_UPLOAD_BYTES) {
      toast.error(`That image is ${formatSize(chosen.size)}. The limit is 5 MB.`);
      clearFile();
      return;
    }
    setFile(chosen);
  }

  async function send(e: FormEvent) {
  e.preventDefault();               // stop the browser's default full-page form submit
  const content = draft.trim();     // trim FIRST — matches backend .trim().min(1)
  if (!content || sending) return;  // block empty messages and double-sends

  setSending(true);
  try {
    // Two transports, one endpoint — mirroring the server's isMultipart()
    // branch. With a file we need progress events, which only XHR provides.
    let res: { message: ChatMessage };

    if (file) {
      const fd = new FormData();
      // These two names must match the backend exactly: "content" is read as
      // a field, "file" as the upload. Any other name is ignored.
      fd.append("content", content);
      fd.append("file", file);

      setProgress(0);   // show the bar immediately, before the first event
      res = await uploadWithProgress<{ message: ChatMessage }>(
        `/alerts/${id}/messages`,
        fd,
        setProgress,
      );
    } else {
      res = await api.post<{ message: ChatMessage }>(`/alerts/${id}/messages`, { content });
    }

    setMessages((cur) =>
      cur.some((m) => m.id === res.message.id) ? cur : [...cur, res.message],
    );
    setDraft("");
    clearFile();
  } catch (err) {
    // 400 too long, 404 not allowed, 413 too large, 415 not really an image.
    toast.error((err as Error).message);
  } finally {
    setSending(false);
    setProgress(null);
  }
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

    <form onSubmit={send} className="flex flex-col gap-2">
      {/* Chosen image, before sending. Only rendered once the preview URL
          exists, so there is never a moment with a broken <img>. */}
      {preview && (
        <div className="flex items-center gap-3 rounded-md border border-line bg-surface-sunken p-2">
          <img src={preview} alt="" className="size-14 rounded object-cover" />
          <div className="min-w-0 flex-1">
            {/* truncate + min-w-0: a long filename must not widen the row */}
            <p className="truncate text-sm text-ink">{file?.name}</p>
            <p className="text-xs text-ink-muted">{file ? formatSize(file.size) : null}</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={clearFile} disabled={sending}>
            Remove
          </Button>
        </div>
      )}

      {/* Upload progress. progress is null except while a file is in flight,
          so this whole block disappears for text-only messages. */}
      {progress !== null && (
        <div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div
              className="h-full bg-brand-500 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Screen readers get the number; sighted users get the bar. */}
          <p className="sr-only" aria-live="polite">Uploading, {progress} percent</p>
        </div>
      )}

      <div className="flex gap-2">
        {/* The input is visually hidden but still focusable, so keyboard users
            reach it and the label lights up via peer-focus-visible. Styling
            the <input type="file"> itself is not portable across browsers. */}
        <input
          id="file"
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pickFile}
          disabled={sending}
          className="peer sr-only"
        />
        <label
          htmlFor="file"
          title="Attach an image"
          className={
            "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md " +
            "border border-line bg-surface px-3 text-ink hover:bg-surface-sunken " +
            "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 " +
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
          }
        >
          <span aria-hidden="true">📎</span>
          <span className="sr-only">Attach an image</span>
        </label>

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
        {/* Still disabled on an empty caption even when an image is chosen:
            the backend requires content, so an image never travels alone. */}
        <Button type="submit" loading={sending} disabled={!draft.trim()}>Send</Button>
      </div>
    </form>
  </main>
);
}

