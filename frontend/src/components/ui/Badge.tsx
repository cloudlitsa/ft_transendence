import type { ReactNode } from "react";

type Tone = "neutral" | "brand" | "success" | "danger" | "alert";
type Appearance = "pill" | "dot";

const pillTones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-muted",
  brand:   "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  danger:  "bg-danger-50 text-danger-700",
  alert:   "bg-alert-50 text-alert-700",
};

const dotTones: Record<Tone, string> = {
  neutral: "bg-ink-muted",
  brand:   "bg-brand-600",
  success: "bg-success-600",
  danger:  "bg-danger-600",
  alert:   "bg-alert-600",
};

interface BadgeProps {
  tone?: Tone;
  appearance?: Appearance;
  /**
   * The label. Rendered as text in a pill; used as the accessible name
   * (and nothing visual) for a dot.
   */
  children: ReactNode;      /**  the content inside the badge */
  /**
   * Announce changes to assistive tech. Use for values that update in
   * place — online status, alert state. Off by default: a static badge
   * announcing itself is noise.
   */
  live?: boolean;
  className?: string;
}

export default function Badge({
  tone = "neutral",
  appearance = "pill",
  live = false,
  children,
  className = "",
}: BadgeProps) {
  if (appearance === "dot") {
    return (
      <span
        role={live ? "status" : "img"}
        aria-label={typeof children === "string" ? children : undefined}
        className={`inline-block size-2 rounded-full ${dotTones[tone]} ${className}`}
      />
    );
  }

  return (
    <span
      role={live ? "status" : undefined}
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 " +
        `text-xs font-medium ${pillTones[tone]} ${className}`
      }
    >
      {children}
    </span>
  );
}