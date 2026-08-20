import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import FormField from "./FormField";

// Omit "id": the component generates its own, so a caller can't
// desynchronise the label/error wiring by passing one.
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
}

const base =
  "rounded-md border px-3 py-2 bg-surface text-ink " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export default function Input({
  label, hint, error, className = "", ...rest
}: InputProps) {
  const id = useId();

  // Error wins: when both exist, only the error is rendered, so only
  // the error should be announced.
  const describedBy = error
    ? `${id}-error`
    : hint
      ? `${id}-hint`
      : undefined;

  const state = error
    ? "border-danger-600 focus-visible:ring-danger-600"
    : "border-line focus-visible:ring-brand-500";

  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <input
        {...rest}
        id={id}
        className={`${base} ${state} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
    </FormField>
  );
}