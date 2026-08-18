import { useState, type FormEvent, type ChangeEvent } from "react";
import { useAuth } from "../lib/AuthContext";
import { useToast } from "../components/ToastProvider";
import { api } from "../lib/api";

const DEFAULT_AVATAR = "/default-avatar.png";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — must match the backend limit
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.displayName ?? "");
  const [savingName, setSavingName] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // RequireAuth guarantees a user here; this guard just satisfies TypeScript.
  if (!user) return null;

  // ----- Save display name -----
  async function saveName(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Display name can't be empty");
      return;
    }
    setSavingName(true);
    try {
      await api.patch("/profile", { displayName: trimmed });
      await refresh(); // update nav/name app-wide
      toast.success("Profile updated");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  // ----- Pick a file: client-side validation + preview (no upload yet) -----
  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      toast.error("Use a JPEG, PNG, or WebP image");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("File too large (max 2 MB)");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f)); // local preview before uploading
  }

  // ----- Upload the picked file -----
  async function uploadAvatar() {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.upload("/profile/avatar", fd);
      await refresh();
      toast.success("Avatar updated");
      setFile(null);
      setPreview(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ----- Remove the current avatar -----
  async function removeAvatar() {
    setBusy(true);
    try {
      await api.delete("/profile/avatar");
      await refresh();
      toast.success("Avatar removed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // What to show: the local preview if picking, else the saved avatar, else default.
  const shownAvatar = preview ?? user.avatarUrl ?? DEFAULT_AVATAR;

  return (
    <div>
      <h1>My profile</h1>

      {/* Avatar */}
      <img
        src={shownAvatar}
        alt="Your avatar"
        width={120}
        height={120}
        style={{ borderRadius: "50%", objectFit: "cover", display: "block" }}
      />

      <div style={{ margin: "1rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} />
        {file && (
          <button onClick={uploadAvatar} disabled={busy}>
            {busy ? "Uploading…" : "Upload"}
          </button>
        )}
        {user.avatarUrl && (
          <button onClick={removeAvatar} disabled={busy}>
            Remove avatar
          </button>
        )}
      </div>

      {/* Read-only info */}
      <p><strong>Email:</strong> {user.email}</p>

      {/* Edit display name */}
      <form onSubmit={saveName} style={{ marginTop: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.25rem" }}>
          Display name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
        />
        <button type="submit" disabled={savingName} style={{ marginLeft: "0.5rem" }}>
          {savingName ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
