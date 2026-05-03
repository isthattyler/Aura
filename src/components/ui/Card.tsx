// ─────────────────────────────────────────
// Card
// ─────────────────────────────────────────
import React from "react";
import clsx from "clsx";
import { formatBytes } from "@/types";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
  onClick?: () => void;
  interactive?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, className, accentColor, onClick, interactive, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-bg-surface border border-border-subtle rounded-xl p-4 relative overflow-hidden",
        interactive && "cursor-pointer transition-all duration-150 hover:border-border-default hover:bg-bg-elevated",
        className
      )}
      style={{
        ...(accentColor ? { borderLeft: `2px solid ${accentColor}` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────
// Badge
// ─────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "muted";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium",
        variant === "default" && "bg-bg-overlay text-text-secondary",
        variant === "success" && "bg-success/15 text-success",
        variant === "warning" && "bg-warning/15 text-warning",
        variant === "danger"  && "bg-danger/15 text-danger",
        variant === "info"    && "bg-info/15 text-info",
        variant === "muted"   && "bg-bg-elevated text-text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────
// SizeLabel
// ─────────────────────────────────────────

interface SizeLabelProps {
  bytes: number;
  className?: string;
  dim?: boolean;
}

export function SizeLabel({ bytes, className, dim }: SizeLabelProps) {
  return (
    <span className={clsx("font-mono text-[11px]", dim ? "text-text-muted" : "text-text-secondary", className)}>
      {formatBytes(bytes)}
    </span>
  );
}

// ─────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// ProgressBar
// ─────────────────────────────────────────

interface ProgressBarProps {
  value: number; // 0–100
  color?: string;
  className?: string;
  height?: number;
}

export function ProgressBar({ value, color, className, height = 4 }: ProgressBarProps) {
  return (
    <div
      className={clsx("w-full bg-bg-overlay rounded-full overflow-hidden", className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          backgroundColor: color ?? "var(--color-accent)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────
// ProgressRing (SVG circular progress)
// ─────────────────────────────────────────

interface ProgressRingProps {
  value: number; // 0–100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  className?: string;
  /** Optional glow effect */
  glow?: boolean;
}

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 6,
  color = "var(--color-accent)",
  trackColor = "var(--color-bg-overlay)",
  children,
  className,
  glow = false,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className={clsx("relative flex items-center justify-center", className)}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.6s ease-out",
            filter: glow ? `drop-shadow(0 0 6px ${color})` : undefined,
          }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
