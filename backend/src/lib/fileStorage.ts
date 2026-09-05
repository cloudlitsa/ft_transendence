// Shared upload engine. Every file the app accepts passes through here.
//
// Three steps, the same for avatars and for chat attachments:
//
//     validate  ->  store  ->  remove
//
// The caller chooses where a file lands, and that choice is what decides who
// can read it back:
//
//   PUBLIC_UPLOADS_DIR = /app/uploads
//       Avatars. server.ts serves this whole directory with @fastify/static
//       under /api/uploads/, so anything inside is readable by anyone, with
//       no login. Correct for a profile picture.
//
//   ATTACHMENTS_DIR = /app/private/attachments
//       Chat attachments. No static route covers this path, so the only way
//       to read one is GET /api/attachments/:id, which checks access first.
//
// One engine, two directories. The validation is shared so a bug in it is
// fixed once. The directories are not shared, because a common folder would
// give every attachment a second, ungated URL.

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const PUBLIC_UPLOADS_DIR = "/app/uploads";
export const ATTACHMENTS_DIR = "/app/private/attachments";


// ---------- Size limits ----------
// Two ceilings, because the two uploads are different things: an avatar is a
// small square, an attachment is a photo off someone's phone.
//
// server.ts registers @fastify/multipart with the 2MB avatar limit globally.
// The chat route passes MAX_ATTACHMENT_BYTES per request instead of raising
// that global, so a larger chat limit doesn't quietly let avatars grow too.

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;


// ---------- Accepted types ----------
// Each entry pairs a mimetype with two things: the extension we store the file
// under, and a test for the byte signature real files of that type begin with.
//
// An upload has to satisfy both, because either one alone has a hole:
//
//   mimetype    Sent by the client in the part header. A claim, not evidence —
//               a shell script can be uploaded as "image/png".
//   signature   The file's own first bytes. Anything the browser will render
//               as an image has to start with these; a script cannot.
//
// `ext` comes from this table, never from the client's filename, so a name
// like "photo.jpg.sh" has no say in what gets written to disk.
//
// PDFs are allowed, but the download route serves them as an attachment
// rather than inline. A PDF rendered in the browser's viewer runs on OUR
// origin, and some viewers execute JavaScript embedded in the file; forcing a
// download keeps user-supplied documents out of that context. Images have to
// stay inline to render in an <img>, and carry no equivalent risk.

// Which types each caller accepts. The map below is everything the engine
// knows how to verify; these lists are what a given route is willing to take.
// Being in the map is necessary but not sufficient, so chat can take PDFs
// without avatars doing so.
//
// They are separate because the two uploads mean different things: an avatar
// is rendered in an <img>, so a PDF avatar would be a permanently broken
// image. One shared list would have let PDFs in there the moment they were
// added for chat.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ATTACHMENT_TYPES = [...IMAGE_TYPES, "application/pdf"] as const;

const ALLOWED_TYPES = new Map<string, { ext: string; magic: (b: Buffer) => boolean }>([
  [
    "image/jpeg",
    { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  ],
  [
    "image/png",
    {
      ext: "png",
      // 89 'P' 'N' 'G' \r \n 1a \n
      magic: (b) =>
        b
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    },
  ],
  [
    "application/pdf",
    {
      ext: "pdf",
      // "%PDF-" — every PDF starts with it, followed by the version number.
      magic: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-",
    },
  ],
  [
    "image/webp",
    {
      ext: "webp",
      // "RIFF" at 0, then a 4-byte length, then "WEBP" at offset 8 — which is
      // why storeFile refuses to judge anything shorter than 12 bytes.
      magic: (b) =>
        b.subarray(0, 4).toString("ascii") === "RIFF" &&
        b.subarray(8, 12).toString("ascii") === "WEBP",
    },
  ],
]);


// ---------- What a caller gets back ----------

export type StoredFile = {
  /** "<uuid>.<ext>" — the name on disk. Internal; never sent to a client. */
  filename: string;
  mimeType: string;
  /** Bytes. Matches the `size` column on Attachment. */
  size: number;
};

// Success and refusal are both ordinary outcomes here — someone picking a PDF
// is not an exceptional event — so they come back as data rather than as a
// thrown error. `ok` discriminates the union, which keeps the route flat:
//
//     if (!result.ok) return reply.code(result.status).send({ error: result.error });
//
// The three codes are distinct on purpose: 400 empty, 413 too large, 415 wrong
// type. A thrown error would collapse them into one catch.

export type StoreResult =
  | { ok: true; file: StoredFile }
  | { ok: false; status: 400 | 413 | 415; error: string };


// ---------- Naming ----------

/**
 * Reduce a client-supplied filename to something safe to store and display.
 *
 * Every upload carries two names, doing different jobs:
 *
 *     filename       generated by us, addresses the file on disk
 *     originalName   the client's, shown to a human and used when downloading
 *
 * Only the second is this function's business. It never becomes a path, but it
 * does reach a Content-Disposition header and the DOM, so three things happen
 * to it on the way in:
 *
 *     path.basename()   drops every directory segment
 *                       "../../etc/passwd"  ->  "passwd"
 *     the regex         drops control characters, quotes and backslashes
 *     slice(0, 200)     stops one very long name from filling the column
 */
export function safeOriginalName(name: string): string {
  const base = path.basename(name ?? "").replace(/[\u0000-\u001f\u007f"\\]/g, "");
  const cleaned = base.trim();
  if (!cleaned) return "file";
  return cleaned.slice(0, 200);
}


// ---------- Validate and store ----------

/**
 * Check a fully-buffered upload, then write it to `dir`.
 *
 * The checks run cheapest-first, and nothing touches the disk until every one
 * of them has passed:
 *
 *     1. empty file                          400
 *     2. larger than maxBytes                413
 *     3. declared type not on the allowlist  415
 *     4. bytes disagree with declared type   415
 *
 * The upload arrives as a complete Buffer rather than a stream because step 4
 * needs the head of the file before anything is written. Buffering means a
 * rejected upload never creates a file that would then have to be cleaned up.
 * The cost is holding up to `maxBytes` in memory per upload — the caller caps
 * the same value at the multipart layer, so an oversized body is cut off
 * before all of it arrives.
 */
export async function storeFile(opts: {
  buffer: Buffer;
  mimeType: string;
  dir: string;
  maxBytes: number;
  /** What this caller accepts — IMAGE_TYPES or ATTACHMENT_TYPES. */
  accept: readonly string[];
}): Promise<StoreResult> {
  const { buffer, mimeType, dir, maxBytes, accept } = opts;

  if (buffer.length === 0) {
    return { ok: false, status: 400, error: "Uploaded file is empty" };
  }
  if (buffer.length > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)`,
    };
  }

  // 3. Is the declared type one THIS caller accepts? The engine can verify
  //    more types than any single route is willing to take.
  const type = accept.includes(mimeType) ? ALLOWED_TYPES.get(mimeType) : undefined;
  if (!type) {
    const names = accept.map((t) => ALLOWED_TYPES.get(t)?.ext ?? t).join(", ");
    return { ok: false, status: 415, error: `Unsupported file type. Use ${names}` };
  }

  // 4. Do the actual bytes agree with what was declared?
  //    12 bytes covers the longest signature we check (WebP's RIFF....WEBP);
  //    the shortest is JPEG's three, so every check has enough to read.
  if (buffer.length < 12 || !type.magic(buffer)) {
    return { ok: false, status: 415, error: "File contents do not match its type" };
  }

  // Our name, not theirs.
  const filename = `${randomUUID()}.${type.ext}`;

  // Docker creates a named volume's mount point as root when the path is not
  // in the image — the silent-failure mode DECISIONS.md records under
  // "Non-root containers". The Dockerfile creates and chowns /app/private for
  // that reason; this mkdir covers the subdirectory underneath it.
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  return { ok: true, file: { filename, mimeType, size: buffer.length } };
}


// ---------- Remove ----------

/**
 * Delete a stored file. Best-effort by design.
 *
 * Called from two places that must not fail because of it:
 *
 *     - the rollback in the message route, when the transaction throws after
 *       the file was already written
 *     - the delete routes, where the row is what the user is removing
 *
 * In both, a file that is already gone is a fine outcome, so errors are
 * swallowed. This is the same rule the avatar routes have always followed.
 */
export async function removeFile(dir: string, filename: string): Promise<void> {
  await unlink(path.join(dir, filename)).catch(() => {});
}
