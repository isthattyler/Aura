import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";

interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  className?: string;
}

export default function Select<T extends string = string>({
  value,
  onChange,
  options,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-bg-overlay border border-border-default text-text-primary text-[12px] rounded-lg px-2.5 py-1.5 hover:border-border-strong transition-colors min-w-[120px]"
      >
        <span className="flex-1 text-left">{selected?.label ?? value}</span>
        <ChevronDown
          size={13}
          className={`text-text-muted transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-bg-surface border border-border-default rounded-lg shadow-lg overflow-hidden animate-fade-in">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 text-[12px] transition-colors ${
                option.value === value
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
