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
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [error, setError] = useState("");   // form-level, from the backend
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); // stop the browser's default full-page reload
    setError(""); // clear any form-level error from a previous attempt
    setFieldErrors({}); // clear any field errors from a previous attempt

    const next: typeof fieldErrors = {};
    if (email.trim().length < 1) next.email = "Email is required";
    if (password.length < 1) next.password = "Please enter your password";
    // Client-side validation mirrors the backend's Zod rules — UX only, not
    // security. Errors attach to their field so a screen reader announces the
    // problem when focus lands on the input, rather than in a separate message
    // the user has to go and find.
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }

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
          error={fieldErrors.email} // Display field-specific error if available
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password} // Display field-specific error if available
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={loading}>
          {loading ? "Logging in…" : "Log in"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}
      </form>
      <div className="mt-4 flex flex-col gap-2">
        <div className="text-center text-sm text-ink-muted">or</div>
         <a href="/api/auth/google"
          className={buttonClasses({ variant: "secondary", className: "w-full" })}
         >
          Continue with Google
        </a>
      </div>
    </main>
  );
}