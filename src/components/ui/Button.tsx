import React from "react";
import clsx from "clsx";
import Spinner from "./Spinner";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ElementType;
  iconPosition?: "left" | "right";
}

export default function Button({
  children,
  variant = "secondary",
  size = "md",
  loading = false,
  icon: Icon,
  iconPosition = "left",
  className,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-150 select-none",
        "active:scale-[0.97]",
        // Sizes
        size === "sm" && "h-7 px-3 text-[11.5px]",
        size === "md" && "h-8 px-4 text-[12.5px]",
        size === "lg" && "h-10 px-5 text-[13px]",
        // Variants
        variant === "primary" && [
          "bg-accent text-bg-base font-semibold",
          "hover:bg-accent-hover",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ],
        variant === "secondary" && [
          "bg-bg-elevated border border-border-default text-text-primary",
          "hover:bg-bg-overlay hover:border-border-strong",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ],
        variant === "ghost" && [
          "text-text-secondary",
          "hover:text-text-primary hover:bg-bg-elevated",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ],
        variant === "danger" && [
          "bg-danger/10 border border-danger/30 text-danger",
          "hover:bg-danger/20 hover:border-danger/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ],
        className
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={12} />
      ) : (
        Icon && iconPosition === "left" && <Icon size={13} strokeWidth={1.8} />
      )}
      {children}
      {!loading && Icon && iconPosition === "right" && (
        <Icon size={13} strokeWidth={1.8} />
      )}
    </button>
  );
}
