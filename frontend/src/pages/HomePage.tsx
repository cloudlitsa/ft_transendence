import { useEffect, useState } from "react";

// Describe the shape of the health response. This is a TypeScript "interface" —
// it says "an object of this type has these fields with these types". Now the
// compiler knows what `health` contains and will catch typos like health.statu.
interface HealthResponse {
  status: string;
  backend: string;
  database: string;
  orm: string;
  db_time: string;
}

export default function HomePage() {
  // useState<HealthResponse | null> means "this holds either a HealthResponse
  // or null". It starts null (before the fetch finishes).
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main>
      <h1>Check-in app</h1>
      <p>Skeleton. If everything below stays connected, the three containers can talk to each other.</p>

      {error && (
        <pre style={{ background: "#fdecea", padding: "1rem", borderRadius: 8 }}>
          Could not reach backend: {error}
        </pre>
      )}

      {health && (
        <pre style={{ background: "#eef7ee", padding: "1rem", borderRadius: 8 }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      )}

      {!health && !error && <p>Checking the stack…</p>}
    </main>
  );
}
