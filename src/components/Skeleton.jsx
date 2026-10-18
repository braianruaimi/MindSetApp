export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-2xl bg-white/10 ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-52" />
    </div>
  );
}
