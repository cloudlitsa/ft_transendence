import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import Heading from "../components/ui/Heading";
import Badge from "../components/ui/Badge";
import Spinner from "../components/ui/Spinner";

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

  if (loading) {
    return (
      <main>
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-ink-muted">
          <Spinner /> Loading…
        </p>
      </main>
    );
  }
 
  if (error) {
    return (
      <main className="flex flex-col gap-3">
        <p role="alert" className="text-ink">{error}</p>
        <Link to="/friends" className="text-brand-600 underline">Back to friends</Link>
      </main>
    );
  }
 
  if (!user) return null;
 
  return (
    <main className="flex flex-col gap-4">
      <Heading level={1}>{user.displayName}</Heading>
 
      {/* size-30 is 7.5rem = 120px, matching the old width/height attributes.
          Keeping those attributes too: they reserve space before the image
          loads, so the page doesn't jump. */}
      <img
        src={user.avatarUrl ?? DEFAULT_AVATAR}
        alt={`${user.displayName}'s avatar`}
        width={120}
        height={120}
        className="size-30 rounded-full object-cover"
      />
 
      {/* Same Badge the friends list uses for the same fact, so the two pages
          can't disagree about what "online" looks like. Replaces the emoji,
          which a screen reader read out as "green circle". */}
      {user.online !== undefined && (
        <div>
          <Badge tone={user.online ? "success" : "neutral"}>
            {user.online ? "Online" : "Offline"}
          </Badge>
        </div>
      )}
 
      <Link to="/friends" className="text-brand-600 underline">Back to friends</Link>
    </main>
  );
}
 