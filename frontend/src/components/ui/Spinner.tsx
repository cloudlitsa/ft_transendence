interface SpinnerProps {
  /** Tailwind size classes — defaults to 1rem square. */
  className?: string;
}

export default function Spinner({ className = "size-4" }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"     // decorative: the accessible state lives on the parent
    >
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"   // "currentColor" because the parent can set the color with text-blue-600, text-gray-400, etc.
        className="opacity-25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor" strokeWidth="4" strokeLinecap="round"
        className="opacity-75"
      />
    </svg>
  );
}