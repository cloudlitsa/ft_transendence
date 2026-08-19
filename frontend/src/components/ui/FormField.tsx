import type { ReactNode } from "react";

interface FormFieldProps {
  /** Owned by the control, which generates it. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export default function FormField({
  id, label, hint, error, children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>

      {children}

      {/* Hint hides when there's an error — two messages compete for attention */}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} className="text-sm text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}