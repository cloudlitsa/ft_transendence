import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";
import Heading from "./Heading";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  /** One line explaining why it's empty and what to do about it. */
  description?: string;
  /** Optional call to action — usually a <Button>. */
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 py-10 text-center ${className}`}>
      {icon && <Icon name={icon} className="size-10 text-ink-muted" />}

      <Heading level={3}>{title}</Heading>

      {description && (
        <p className="max-w-sm text-sm text-ink-muted">{description}</p>
      )}

      {action}
    </div>
  );
}