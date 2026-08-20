import { useState, type FormEvent, type ChangeEvent } from "react";
import { useAuth } from "../lib/AuthContext";
import { useToast } from "../components/ToastProvider";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";

const DEFAULT_AVATAR = "/default-avatar.png";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — must match the backend limit
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.displayName ?? "");
  const [savingName, setSavingName] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // GDPR delete-account confirmation
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);


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
//  GDPR: download all my data 
  function exportData() {
    // Hitting the endpoint directly triggers the browser download
    // (the backend sends Content-Disposition: attachment).
    window.location.href = "/api/account/export";
  }

  //  GDPR: permanently delete my account 
  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    if (!password) {
      toast.error("Enter your password to confirm");
      return;
    }
    setDeleting(true);
    try {
      await api.delete("/account", { password });
      toast.success("Account deleted");
      await refresh();   // /auth/me now 401s → clears the user app-wide
      navigate("/");     // leave the (now inaccessible) profile page
    } catch (err) {
      toast.error((err as Error).message); // "Incorrect password", etc.
    } finally {
      setDeleting(false);
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
      {/*  Account (GDPR)  */}
      <hr style={{ margin: "2rem 0" }} />
      <section>
        <h2>Account</h2>

        <button onClick={exportData}>Download my data</button>

        <div style={{ marginTop: "1rem" }}>
          {!confirmingDelete ? (
            <button onClick={() => setConfirmingDelete(true)}>
              Delete account
            </button>
          ) : (
            <form onSubmit={deleteAccount}>
              <p style={{ color: "#b91c1c" }}>
                This permanently deletes your account and all your data. Enter
                your password to confirm.
              </p>
              <input
                type="password"
                aria-label="Confirm your password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit" disabled={deleting} style={{ marginLeft: "0.5rem" }}>
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => { setConfirmingDelete(false); setPassword(""); }}
                style={{ marginLeft: "0.5rem" }}
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
