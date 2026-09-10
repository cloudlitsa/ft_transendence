import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.tsx";
import Input from "../components/ui/Input";
import Button, { buttonClasses } from "../components/ui/Button";
import Heading from "../components/ui/Heading.tsx";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    password?: string;
  }>({});
  const [error, setError] = useState("");   // form-level, from the backend
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

  // Client-side validation mirrors the backend's Zod rules — UX only, not
  // security. Errors attach to their field so a screen reader announces the
  // problem when focus lands on the input, rather than in a separate message
  // the user has to go and find.
  const next: typeof fieldErrors = {};
  if (displayName.trim().length < 1) next.displayName = "Display name is required";
  if (password.length < 8) next.password = "Must be at least 8 characters";

  if (Object.keys(next).length > 0) {
    setFieldErrors(next);
    return;
  }

  setLoading(true);
  try {
    await api.post("/auth/signup", { email, password, displayName });
    await refresh();
    navigate("/");
  } catch (err) {
    setError((err as Error).message); // api.ts throws the backend's message
  } finally {
    setLoading(false);
  }
}
  return (
    <main className="flex flex-col gap-8">
      <Heading level={1}>Sign up</Heading>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Display name"
          type="text"
          autoComplete="off"
          value={displayName}
          error={fieldErrors.displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          value={password}
          error={fieldErrors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={loading}>
          {loading ? "Creating account…" : "Sign up"}
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