import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.tsx";
import Input from "../components/ui/Input";
import Button, { buttonClasses } from "../components/ui/Button";
import Heading from "../components/ui/Heading.tsx";

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
      // On success the backend sets the httpOnly auth cookie — user is now
      // logged in, and refresh() syncs the context.
      await api.post("/auth/login", { email, password });
      await refresh();
      navigate("/friends");
    } catch (err) {
      setError((err as Error).message); // api.ts throws the backend's message
    } finally {
      setLoading(false); // runs on both paths, so loading never sticks
    }
  }

  return (
    <main className="flex flex-col gap-8">
      <Heading level={1}>Log in</Heading>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={loading}>
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        <div className={buttonClasses({ variant: "secondary", className: "w-full" })}>or</div>
         <a href="/api/auth/google"
          className={buttonClasses({ variant: "secondary", className: "w-full" })}
         >
          Continue with Google
        </a>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger-700">
          {error}
        </p>
      )}
    </main>
  );
}