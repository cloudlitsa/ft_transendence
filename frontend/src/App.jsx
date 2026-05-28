import { useEffect, useState } from "react";

// This component does ONE thing: prove the whole stack is wired up.
// It calls the backend's /api/health endpoint, which itself talks to
// the database. If we see "connected", all three containers can reach
// each other. That's the entire goal of the skeleton.
export default function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 600 }}>
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
