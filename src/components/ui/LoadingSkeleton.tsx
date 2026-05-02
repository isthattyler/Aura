import clsx from "clsx";

interface SkeletonProps {
  className?: string;
  lines?: number;
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "bg-bg-elevated rounded-md animate-pulse",
        className
      )}
    />
  );
}

export function SkeletonLine({ className }: { className?: string }) {
  return <SkeletonBlock className={clsx("h-3 w-full", className)} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx("bg-bg-surface border border-border-subtle rounded-xl p-4 space-y-3", className)}>
      <SkeletonLine className="w-1/3 h-4" />
      <SkeletonLine className="w-2/3 h-3" />
      <SkeletonLine className="w-1/2 h-3" />
    </div>
  );
}

export function SkeletonList({ lines = 5, className }: SkeletonProps) {
  return (
    <div className={clsx("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={i === 0 ? "w-3/4" : i % 2 === 0 ? "w-2/3" : "w-1/2"} />
      ))}
    </div>
  );
}

export function SkeletonPage({ className }: { className?: string }) {
  return (
    <div className={clsx("p-6 space-y-6", className)}>
      <SkeletonLine className="w-1/4 h-5" />
      <div className="grid grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard />
      <SkeletonList lines={4} />
    </div>
  );
}
