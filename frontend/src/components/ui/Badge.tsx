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
   * The label/content.
   * - In a pill, this is rendered as-is.
   * - In a dot, it is only rendered for screen readers (visually hidden).
   */
  children: ReactNode;
  /**
   * Announce changes to assistive tech. Use for values that update in
   * place — online status, alert state. Off by default: a static badge
   * announcing itself is noise.
   */
  live?: boolean;
  className?: string;
  /**
   * Native browser tooltip on hover. Sighted mouse users get no benefit from
   * the aria-label, so a dot whose meaning is carried entirely by colour
   * should usually have one.
   */
  title?: string;
}

export default function Badge({
  tone = "neutral",
  appearance = "pill",
  live = false,
  children,
  className = "",
  title,
}: BadgeProps) {
      if (appearance === "dot") {
    const dot = `inline-block size-2 rounded-full ${dotTones[tone]} ${className}`;

    // Live status: two elements, each doing one job.
    // The dot is decoration — hidden from screen readers, keeps the tooltip.
    // The sr-only span is the live region: role="status" announces its TEXT
    // when that text changes, so the words have to be inside it.
    if (live) {
      return (
        <>
          <span aria-hidden="true" title={title} className={dot} />
          <span role="status" className="sr-only">{children}</span>
        </>
      );
    }

    // Static dot: role="img" ignores its contents, so the name must be a label.
    return (
      <span
        role="img"
        aria-label={typeof children === "string" ? children : undefined}
        title={title}
        className={dot}
      />
    );
  }
}