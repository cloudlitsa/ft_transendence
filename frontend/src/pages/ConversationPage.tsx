import { useEffect, useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.tsx";
import Spinner from "../components/ui/Spinner";
import type { ChatAttachment, ChatMessage, ChatSender  } from "../lib/chat";
import { attachmentUrl } from "../lib/chat";
import { useMessages } from "../lib/MessagesContext.tsx";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
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
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
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
    <span aria-hidden="true" className="size-7 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-semibold">
      {initials}
    </span>
  );
}

// One attachment inside a message bubble.
//
// The <img src> is a ROUTE, not a static file. Every one of these tags fires a
// real request that runs canAccessAlert on the server, and the session cookie
// rides along automatically because it is same-origin — which is why an <img>
// can point at an authenticated endpoint at all without any JavaScript.
//
// `mine` only picks colours: the bubble behind this is brand-blue for your own
// messages and a pale surface for everyone else's, so the placeholder needs
// two different treatments to stay readable.
//
// `onDelete` is passed only for your own attachments, so its presence is what
// decides whether the remove control is drawn. That is a convenience, not the
// security boundary: the backend answers 403 to anyone who is not the message
// author, whether or not a button was ever rendered.
function Attachment({
  attachment,
  mine,
  onDelete,
}: {
  attachment: ChatAttachment;
  mine: boolean;
  onDelete?: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleDelete() {
    if (!onDelete) return;
    setRemoving(true);
    try {
      await onDelete();
    } finally {
      // Safe even though the successful path re-renders this into the
      // placeholder below: it is the same component instance either way.
      setRemoving(false);
    }
  }

  // The sender removed it. The row survives precisely so this can be shown —
  // a hard delete would leave a bubble indistinguishable from one that never
  // had an image, and the conversation would quietly rewrite itself.
  if (attachment.deletedAt) {
    return (
      <p
        className={
          "rounded-lg border border-dashed px-3 py-2 text-xs italic " +
          (mine ? "border-white/40 text-white/80" : "border-line text-ink-muted")
        }
      >
        {/* mime_type survives the soft delete, so the placeholder can still
            name what was here rather than calling every file an image. */}
        {attachment.mimeType.startsWith("image/") ? "Image removed" : "File removed"}
      </p>
    );
  }

  const href = attachmentUrl(attachment);

  if (attachment.mimeType.startsWith("image/")) {
    return (
      <div className="relative">
        {/* Wrapped in a link so the full-size image is one click away — the
            thumbnail is capped at max-h-72 so a tall photo can't take over
            the whole conversation. */}
        <a href={href} target="_blank" rel="noreferrer" className="block">
          <img
            src={href}
            // The caption sits right beside this in the bubble and is already
            // read aloud, so the filename is the useful addition here: it
            // announces that an image is present and names it, without
            // repeating the caption.
            alt={attachment.originalName}
            loading="eager" // the bubble is already on screen, so load it now
            className="max-h-72 w-auto max-w-full rounded-lg"
          />
        </a>

        {onDelete && (
          // Always visible, never hover-only: a touch device has no hover, so
          // a control that appears on :hover is a control phone users cannot
          // find. Sits on the image rather than below it so the bubble does
          // not grow taller for everyone else.
          <button
            type="button"
            onClick={handleDelete}
            disabled={removing}
            aria-label={`Remove ${attachment.originalName}`}
            className={
              "absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full " +
              "bg-ink/60 text-white backdrop-blur-sm transition-colors hover:bg-ink/80 " +
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white " +
              "disabled:opacity-50 disabled:cursor-not-allowed"
            }
          >
            {removing ? <Spinner /> : <Icon name="x" className="size-4" />}
          </button>
        )}
      </div>
    );
  }

  // Not an image — a PDF today. There is nothing to render, so it gets a card
  // that names the file and links to it. The server sends these with
  // Content-Disposition: attachment, so the link downloads rather than opening
  // a document from our origin in the browser's PDF viewer.
  return (
    <div
      className={
        "flex items-center gap-2 rounded-lg border px-2 py-1.5 " +
        (mine ? "border-white/30 bg-white/10" : "border-line bg-surface")
      }
    >
      <span aria-hidden="true" className="text-lg">📄</span>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1 text-sm underline"
      >
        {/* truncate + min-w-0 so a long filename can't widen the bubble */}
        <span className="block truncate">{attachment.originalName}</span>
        <span className={mine ? "text-xs text-white/70" : "text-xs text-ink-muted"}>
          {formatSize(attachment.size)}
        </span>
      </a>

      {onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={removing}
          aria-label={`Remove ${attachment.originalName}`}
          className={
            "grid size-6 shrink-0 place-items-center rounded-full " +
            (mine ? "text-white/80 hover:bg-white/20" : "text-ink-muted hover:bg-surface-sunken") +
            " focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 " +
            "disabled:opacity-50 disabled:cursor-not-allowed"
          }
        >
          {removing ? <Spinner /> : <Icon name="x" className="size-4" />}
        </button>
      )}
    </div>
  );
}

interface HeaderAlert {
  note?: string | null;
  status?: string;
  sender?: { id: string; displayName: string; avatarUrl: string | null };
}

export default function ConversationPage() {
  const { id } = useParams();   // reads the ":id" out of the URL

  const [alert, setAlert] = useState<HeaderAlert | undefined>();
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .get<{ alert: HeaderAlert }>(`/alerts/${id}`)
      .then((res) => {
        if (!cancelled) setAlert(res.alert);
      })
      .catch(() => {
        // Header hides on failure. An id we can't read is already reported by
        // the messages fetch below, which owns the page-level error state.
        if (!cancelled) setAlert(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { user } = useAuth();      // to tell my messages from everyone else's

  const { messages, setMessages, setOpenAlertId, removeAttachment, closedAlertId } =
    useMessages();

  // The sender closed this check-in while we were reading it. Flip the header
  // in place rather than refetching: "closed" is the whole of what changed,
  // and this produces exactly the state a reload would.
  useEffect(() => {
    if (!closedAlertId || closedAlertId !== id) return;
    setAlert((cur) =>
      cur && cur.status !== "closed" ? { ...cur, status: "closed" } : cur,
    );
    // alert?.status is in the deps because the close can land while the fetch
    // above is still in flight: the effect would run against an undefined
    // alert, no-op, and then be overwritten by a response that still says
    // "active". Re-running when the status arrives applies it either way; the
    // guard inside stops it looping.
  }, [closedAlertId, id, alert?.status]);

  const toast = useToast();

  const [loading, setLoading] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");      // what's currently typed in the box
  const [sending, setSending] = useState(false); // true while a send is in flight
  const bottomRef = useRef<HTMLLIElement>(null);

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
  // Only images get one: a blob: URL for a PDF in an <img> is just a broken
  // image, so the composer shows a file card for those instead.
  //
  // createObjectURL hands back a "blob:" URL the browser keeps alive until the
  // page unloads or the URL is revoked. Choosing several images in a row
  // without revoking pins every one of them in memory, so the cleanup function
  // returned below matters — React runs it before the next effect and on
  // unmount.
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
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

  // Remove one of your own attachments.
  //
  // Irreversible and one stray tap away on a phone, so it asks first. The
  // message text stays either way — only the image goes.
  async function deleteAttachment(attachment: ChatAttachment, alertId: string) {
    if (!window.confirm(`Remove ${attachment.originalName}? This can't be undone.`)) {
      return;
    }
    try {
      await api.delete(`/attachments/${attachment.id}`);
      // Update local state directly rather than waiting for the socket. The
      // broadcast does reach this tab too — the backend deliberately doesn't
      // skip the deleter, so other devices get it — but marking here means the
      // image goes immediately even if the socket is down. removeAttachment
      // ignores a second arrival, so the duplicate costs nothing.
      removeAttachment({ id: attachment.id, alertId });
    } catch (err) {
      // 403 if it isn't yours, 404 if it vanished, network errors otherwise.
      toast.error((err as Error).message);
    }
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
      toast.error("Images (jpeg, png, webp) or PDF only.");
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
              {alert.sender && alert.sender.id !== user?.id
                ? `${alert.sender.displayName} sent a check-in`
                : "Your check-in"}
            </p>
            <Badge tone={alert.status === "closed" ? "neutral" : "success"}>
              {alert.status === "closed" ? "closed" : "active"}
            </Badge>
          </div>
          {alert.note && <p className="mt-1 font-medium text-ink">"{alert.note}"</p>}
        </div>
      </Card>
    )}

    <ul className="flex flex-col gap-3" role="log" aria-live="polite">
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
                  "flex flex-col gap-2 " +
                  (mine
                    ? "bg-brand-600 text-white rounded-2xl rounded-br-sm px-3 py-2"
                    : "bg-surface-sunken border border-line rounded-2xl rounded-bl-sm px-3 py-2")
                }
              >
                {/* Images first, caption under them — the usual chat reading
                    order. attachments is always an array, [] for text-only
                    messages, so no null check is needed. */}
                {m.attachments.map((a) => (
                  <Attachment
                    key={a.id}
                    attachment={a}
                    mine={mine}
                    // Only your own attachments get a delete handler, and so
                    // only they get the control.
                    onDelete={mine ? () => deleteAttachment(a, m.alertId) : undefined}
                  />
                ))}
                {m.content}
              </div>
              <p className="text-xs text-ink-muted mt-0.5">{formatWhen(m.createdAt)}</p>
            </div>
          </li>
        );
      })}
      <li aria-hidden="true" ref={bottomRef} />
    </ul>

    {/* The whole composer goes, file picker included — disabling only Send
        would let someone attach an image and then find no way to send it.

        `?.` matters: if the alert failed to load, status is undefined and the
        composer stays. The server refuses either way (409), and guessing
        "closed" would lock someone out over one failed request. */}
    {alert?.status === "closed" ? (
      <p
        role="status"
        className="rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink-muted"
      >
        This check-in was closed. You can still read the conversation.
      </p>
    ) : (
    <form onSubmit={send} className="flex flex-col gap-2">
      {/* The chosen file, before sending. Keyed off `file` rather than
          `preview`, because a PDF has no preview URL — it gets a document
          glyph in the same slot, so the row keeps one shape either way. */}
      {file && (
        <div className="flex items-center gap-3 rounded-md border border-line bg-surface-sunken p-2">
          {preview ? (
            <img src={preview} alt="" className="size-14 rounded object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-14 shrink-0 place-items-center rounded bg-surface text-xl"
            >
              📄
            </span>
          )}
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
          accept="image/jpeg,image/png,image/webp,application/pdf"
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
          // A caption is required, so with a file chosen and an empty box the
          // Send button is disabled. Say why here rather than leaving someone
          // to work it out from a greyed-out button.
          placeholder={file ? "Add a caption to send…" : "Type a message…"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); }
          }}
          className="flex-1 border border-line rounded-md px-3 py-2 bg-surface-sunken resize-none"
        />
        {/* Still disabled on an empty caption even when a file is chosen: the
            backend requires content, so an attachment never travels alone.
            The title explains the disabled state on hover; the placeholder
            above carries the same message where the cursor already is. */}
        <Button
          type="submit"
          loading={sending}
          disabled={!draft.trim()}
          title={!draft.trim() && file ? "Add a caption to send this file" : undefined}
        >
          Send
        </Button>
      </div>
    </form>
    )}
  </main>
);
}

