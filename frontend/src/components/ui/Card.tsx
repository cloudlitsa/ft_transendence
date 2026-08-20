import type { HTMLAttributes, ReactNode } from "react";

type Padding = "none" | "sm" | "md";

const paddings: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  children: ReactNode;
}

export default function Card({
  padding = "md",
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`bg-surface border border-line rounded-lg ${paddings[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}