import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.tsx";
import { buttonClasses } from "../components/ui/Button";
import Heading from "../components/ui/Heading";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Banner from "../components/ui/Banner";

// The /api/health response. Kept from the original skeleton page: it is still
// the fastest way to confirm all three containers are talking, but it belongs
// behind a disclosure rather than on the landing page.
interface HealthResponse {
  status: string;
  backend: string;
  database: string;
  orm: string;
  db_time: string;
}

export default function HomePage() {
  const { user, loading } = useAuth();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="flex flex-col gap-8">
      {/* ---- What the app is, and the way in ---- */}
      <section className="flex flex-col gap-3">
        <Heading level={1}>Check in with the people who would notice</Heading>
 
        <p className="max-w-prose text-base leading-relaxed text-ink-muted">
          Send a check-in to the friends you choose, and see theirs. They can
          acknowledge it, so you both know it was seen. This is not an
          emergency service — it is a way of staying in touch with the few
          people who would want to know you are all right.
        </p>
 
        {/* Rendered only once auth is resolved, so the buttons don't flip
            from logged-out to logged-in a moment after paint. */}
        {!loading && (
          <div className="flex flex-col gap-3 sm:flex-row">
            {user ? (
              <>
                <Link
                  to="/alerts"
                  className={buttonClasses({ variant: "alert", size: "lg" })}
                >
                  Send a check-in
                </Link>
                <Link
                  to="/friends"
                  className={buttonClasses({ variant: "secondary", size: "lg" })}
                >
                  My friends
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/signup"
                  className={buttonClasses({ variant: "primary", size: "lg" })}
                >
                  Create an account
                </Link>
                <Link
                  to="/login"
                  className={buttonClasses({ variant: "secondary", size: "lg" })}
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        )}
      </section>
 
      {/* ---- How it works. Stacked on a phone, three across from 640px. ---- */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Heading level={3} as="h2">Add your people</Heading>
          <p className="mt-2 text-sm text-ink-muted">
            Send a friend request by email. Nothing is shared until they
            accept.
          </p>
        </Card>
 
        <Card>
          <Heading level={3} as="h2">Check in</Heading>
          <p className="mt-2 text-sm text-ink-muted">
            One tap tells your friends you are all right. It reaches them
            straight away.
          </p>
        </Card>
 
        <Card>
          <Heading level={3} as="h2">See it was seen</Heading>
          <p className="mt-2 text-sm text-ink-muted">
            Friends acknowledge your check-in, and you see the acknowledgement
            appear without refreshing.
          </p>
        </Card>
      </section>
 
      {/* ---- The old skeleton, kept but demoted ---- */}
      <details className="rounded-lg border border-line p-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-muted">
          System status{" "}
          {health && <Badge tone="success">Connected</Badge>}
          {error && <Badge tone="danger">Unreachable</Badge>}
        </summary>
 
        <div className="mt-3">
          {error && <Banner tone="danger">Could not reach the backend: {error}</Banner>}
 
          {health && (
            // overflow-x-auto so a long db_time scrolls inside the box
            // instead of widening the page on a phone.
            <pre className="overflow-x-auto rounded-md bg-surface-sunken p-3 text-xs text-ink-muted">
              {JSON.stringify(health, null, 2)}
            </pre>
          )}
 
          {!health && !error && (
            <p className="text-sm text-ink-muted">Checking the stack…</p>
          )}
        </div>
      </details>
    </main>
  );
}
 
