import { TableSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function AllocationLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
