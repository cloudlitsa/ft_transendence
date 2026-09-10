import { useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { useAuth } from "../lib/AuthContext";
import { useToast } from "../components/ToastProvider";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Heading from "../components/ui/Heading";
import Input from "../components/ui/Input";


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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GDPR delete-account confirmation
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
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

    if (user!.hasPassword) {
      if (!password) {
        toast.error("Enter your password to confirm");
        return;
      }
    } else {
      if (confirmEmail !== user!.email) {
        toast.error("Type your email address exactly to confirm");
        return;
      }
    }

    setDeleting(true);
    try {
      // Send the field that matches the account type.
      const body = user!.hasPassword ? { password } : { confirmEmail };
      await api.delete("/account", body);
      toast.success("Account deleted");
      await refresh();
      navigate("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }
 
  // What to show: the local preview if picking, else the saved avatar, else default.
  const shownAvatar = preview ?? user.avatarUrl ?? DEFAULT_AVATAR;

    return (
    <main className="flex flex-col gap-8">
      <Heading level={1}>My profile</Heading>
 
      {/* ---------- Avatar ---------- */}
      <div className="flex flex-col gap-4">
        <img
          src={shownAvatar}
          alt="Your avatar"
          width={120}
          height={120}
          className="size-30 rounded-full object-cover"
        />
 
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="secondary"
            className="w-fit"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose a new avatar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPick}
            tabIndex={-1}
            className="sr-only"
            aria-hidden="true"
          />
 
          <div className="flex flex-wrap gap-2">
            {file && (
              <Button type="button" onClick={uploadAvatar} loading={busy}>
                Upload
              </Button>
            )}
            {user.avatarUrl && (
              <Button type="button" variant="secondary" onClick={removeAvatar} disabled={busy}>
                Remove avatar
              </Button>
            )}
          </div>
        </div>
      </div>
 
      {/* ---------- Details ---------- */}
      <div className="flex flex-col gap-4">
        <p className="text-ink-muted">
          <span className="font-bold text-ink">Email:</span> {user.email}
        </p>
 
        {/* Stacked on a phone, side by side from 640px. */}
        <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Display name"
              type="text"
              autoComplete="off"
              value={name}
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Button type="submit" loading={savingName}>Save</Button>
          </div>
        </form>
      </div>
 
      {/* ---------- Account (GDPR) ---------- */}
      {/* border-t replaces the <hr>. A section divider is a border, not an
          element — Preflight already unstyles <hr> anyway. */}
      <section aria-label="Account" className="flex flex-col gap-4 border-t border-line pt-8">
        <Heading level={2}>Account</Heading>
 
        <div>
          <Button type="button" variant="secondary" onClick={exportData}>
            Download my data
          </Button>
        </div>
 
        {!confirmingDelete ? (
          // The first click only reveals the confirmation. Nothing has happened
          // yet, so this is a secondary button — red is saved for the one that
          // actually does it.
          <div>
            <Button type="button" variant="secondary" onClick={() => setConfirmingDelete(true)}>
              Delete account
            </Button>
          </div>
        ) : (
          <form onSubmit={deleteAccount} className="flex flex-col gap-3">
            <p className="text-sm text-danger-700">
              This permanently deletes your account and all your data.
              {user.hasPassword
                ? " Enter your password to confirm."
                : " Type your email address to confirm."}
            </p>

            {user.hasPassword ? (
              <Input
                label="Confirm your password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            ) : (
              <Input
                label={`Type: "${user.email}" to confirm`}
                type="email"
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
              />
            )}

            <div className="flex flex-wrap gap-2">
              {/* The one genuinely destructive, irreversible action on the page.  
                  This is what the danger token is reserved for. */}
              <Button type="submit" variant="danger" loading={deleting}>
                Confirm delete
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setConfirmingDelete(false); setPassword(""); setConfirmEmail(""); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
