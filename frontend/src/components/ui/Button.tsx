// frontend/src/components/ui/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import Spinner from "./Spinner";

type Variant = "primary" | "secondary" | "danger" | "alert";
type Size = "sm" | "md" | "lg";

// Shared by every button: shape, focus behaviour, disabled behaviour.
const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";        // focus-visible only shows ring for keyboard navigation, not mouse click which is annoying. 

const variants: Record<Variant, string> = {     // not conditional, so it fails at compile time if you forget one - rather than silently failing to the default.
  primary:   "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-sunken focus-visible:ring-brand-500",
  danger:    "bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-600",
  alert:     "bg-alert-500 text-ink hover:bg-alert-600 focus-visible:ring-alert-600",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2",
  lg: "text-base px-5 py-3",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { // extends means "all the props of a normal <button> plus these extra ones" - reusability!
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return ( // the {...rest} is a "spread" operator that takes all the other props and passes them to the <button> element. This is how we get onClick, type, etc. for free.
    <button
      type="button"                                  // before {...rest} so callers can override
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}