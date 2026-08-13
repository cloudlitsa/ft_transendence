import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.tsx"

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); // stop the browser's default full-page reload
    setError("");       // clear any error from a previous attempt

    // Client-side validation mirrors the backend's Zod rules — UX only, not security.
    // Early return means we never send a request we already know is invalid.
    if (displayName.trim().length < 1) {
      setError("Display name is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      // On success the backend sets the httpOnly auth cookie — user is now logged in and refresh() syncs the context.
      await api.post("/auth/signup", { email, password, displayName });
      await refresh();
      navigate("/");
    } catch (err) {
      setError((err as Error).message); // api.ts throws the backend's message
    } finally {
      setLoading(false); // runs on both success and failure, so loading never sticks
    }
  }

  return (
    <main>
      <h1>Sign up</h1>
      <form onSubmit={handleSubmit}>
        <label style={{ display: "flex", flexDirection: "column" }}>
          Display name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column" }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column" }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
    </main>
  );
}
