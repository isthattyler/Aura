import clsx from "clsx";

interface SpinnerProps {
  size?: number;
  color?: string;
  className?: string;
}

export default function Spinner({ size = 16, color, className }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={clsx("animate-spin", className)}
      style={{ color: color ?? "var(--color-accent)" }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
