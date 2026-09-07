// The shapes the chat API returns. These mirror `messageSelect` in
// backend/src/routes/messages.ts — if that select changes, this file has to
// change with it, because nothing checks them against each other at runtime.

export interface ChatSender {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

// One file attached to a message.
//
// Note what is NOT here: the name of the file on disk. The backend keeps that
// to itself, so the only way to reach the image is by id:
//
//     <img src={`/api/attachments/${attachment.id}`} />
//
// That URL is a real route, not a static file. It checks on every request
// that the viewer can see the conversation this attachment belongs to.
export interface ChatAttachment {
  id: string;
  /** The uploader's filename, sanitised. Display and alt text only. */
  originalName: string;
  mimeType: string;
  /** Bytes. */
  size: number;
  /**
   * ISO timestamp when the sender removed it, or null while it is live.
   */
  deletedAt: string | null;
}

export interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;   // JSON has no Date type — this arrives as an ISO string
  alertId: string;     // which conversation this belongs to (needed for real-time)
  sender: ChatSender;
  /**
   * Always present, `[]` when the message is text-only — the server sends the
   * array either way, so callers can map over it without a null check.
   */
  attachments: ChatAttachment[];
}

/**
 * Where to fetch an attachment's bytes.
 *
 * This is a ROUTE, not a static file path. Every request to it runs the same
 * access check as the conversation itself, so the URL is useless to anyone
 * outside the alert's circle. Kept here so the shape lives in one place.
 */
export function attachmentUrl(attachment: ChatAttachment): string {
  return `/api/attachments/${attachment.id}`;
}
