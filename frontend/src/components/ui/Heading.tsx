import type { ReactNode } from "react";

type Level = 1 | 2 | 3;

/**
 * The type scale. Each level pairs a size, weight and colour — the three
 * decisions that make headings look like a system rather than assorted
 * large text.
 */
const levels: Record<Level, string> = {
  1: "text-2xl font-bold text-ink",
  2: "text-xl font-semibold text-ink",
  3: "text-base font-semibold text-ink",
};

interface HeadingProps {
  /** Semantic level. Also picks the visual style unless `as` overrides it. */
  level?: Level;
  /**
   * Render a different tag than `level` implies. Use only to keep the
   * document outline correct when the visual size would otherwise force
   * a heading-order skip.
   */
  as?: "h1" | "h2" | "h3";
  children: ReactNode;
  className?: string;
}

export default function Heading({
  level = 2,
  as,
  children,
  className = "",
}: HeadingProps) {
  const Tag = as ?? (`h${level}` as const);

  return <Tag className={`${levels[level]} ${className}`}>{children}</Tag>;
}