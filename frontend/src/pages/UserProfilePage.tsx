import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";

const DEFAULT_AVATAR = "/default-avatar.png";

// Public shape returned by GET /api/profile/:id — no email, no password.
interface PublicUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  online?: boolean; // present while the presence feature is enabled
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true; // guards against setting state after unmount
    setLoading(true);
    setError(null);
    api
      .get<{ user: PublicUser }>(`/profile/${id}`)
      .then((res) => { if (active) setUser(res.user); })
      .catch((err) => { if (active) setError((err as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  if (loading) return <p>Loading…</p>;
  if (error) return <p>{error} — <Link to="/friends">Back to friends</Link></p>;
  if (!user) return null;

  return (
    <div>
      <h1>{user.displayName}</h1>

      <img
        src={user.avatarUrl ?? DEFAULT_AVATAR}
        alt={`${user.displayName}'s avatar`}
        width={120}
        height={120}
        style={{ borderRadius: "50%", objectFit: "cover", display: "block" }}
      />

      {/* Show status only when the backend provides it */}
      {user.online !== undefined && (
        <p>{user.online ? "🟢 Online" : "⚪ Offline"}</p>
      )}

      <Link to="/friends">Back to friends</Link>
    </div>
  );
}
