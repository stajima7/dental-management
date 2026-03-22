import { TableSkeleton, KpiCardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function CostsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}
