import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, { box: string; icon: IconName }> = {
  info:    { box: "bg-brand-50 border-brand-500 text-brand-700",      icon: "info" },
  success: { box: "bg-success-50 border-success-600 text-success-700", icon: "check" },
  warning: { box: "bg-alert-50 border-alert-600 text-alert-700",       icon: "alertTriangle" },
  danger:  { box: "bg-danger-50 border-danger-600 text-danger-700",    icon: "alertTriangle" },
};

interface BannerProps {
  tone?: Tone;
  /** Announce when it appears. Set false for static page content. */
  live?: boolean;
  /** The content of the banner. */
  children: ReactNode;
  /** Renders a dismiss button when provided. */
  onDismiss?: () => void;
  className?: string;
}

export default function Banner({
  tone = "info",
  live = true,
  children,
  onDismiss,
  className = "",
}: BannerProps) {
  const { box, icon } = tones[tone];
   // Problems interrupt (alert); confirmations wait their turn (status).
   // Static content (live={false}) isn't announced at all.
  const liveRole = tone === "danger" || tone === "warning" ? "alert" : "status";

  return (
    <div
      role={live ? liveRole : undefined}
      className={`flex items-start gap-3 rounded-md border-l-4 p-3 text-sm ${box} ${className}`}
    >
      <Icon name={icon} className="size-5 shrink-0" />
      <div className="flex-1">{children}</div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        >
          <Icon name="x" className="size-4" />
        </button>
      )}
    </div>
  );
}
