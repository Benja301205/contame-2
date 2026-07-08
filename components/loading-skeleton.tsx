export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando">
      <div className="h-6 w-40 animate-pulse rounded bg-muted" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-24 w-full max-w-2xl animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
