import clsx from "clsx";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function Checkbox({
  checked,
  onChange,
  label,
  indeterminate,
  disabled,
  className,
}: CheckboxProps) {
  return (
    <label
      className={clsx(
        "inline-flex items-center gap-2 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div
        className={clsx(
          "w-4 h-4 rounded flex items-center justify-center border transition-all duration-150 shrink-0",
          checked || indeterminate
            ? "bg-accent border-accent"
            : "bg-bg-elevated border-border-default hover:border-border-strong",
          disabled && "pointer-events-none"
        )}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onChange(!checked);
        }}
      >
        {indeterminate ? (
          <div className="w-2 h-0.5 rounded bg-white" />
        ) : checked ? (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </div>
      {label && (
        <span className="text-[12px] text-text-primary font-medium">{label}</span>
      )}
    </label>
  );
}
