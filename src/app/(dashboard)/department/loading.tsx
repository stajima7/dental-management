import { TableSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function DepartmentLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <TableSkeleton rows={7} cols={6} />
    </div>
  );
}
