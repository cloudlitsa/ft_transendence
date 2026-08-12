import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.tsx"

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();
  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); // stop the browser's default full-page reload
    setError("");       // clear any error from a previous attempt
    setLoading(true);
    try {
      // On success the backend sets the httpOnly auth cookie — user is now logged in  and refresh() syncs the context.
      await api.post("/auth/login", { email, password });
      await refresh();
      navigate("/friends");
    } catch (err) {
      setError((err as Error).message); // api.ts throws the backend's message
    } finally {
      setLoading(false); // runs on both success and failure, so loading never sticks
    }
  }

  return (
    <main>
      <h1>Log in</h1>
      <form onSubmit={handleSubmit}>
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
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      {error && <p style={{ color: "#b00020" }}>{error}</p>}
    </main>
  );
}
