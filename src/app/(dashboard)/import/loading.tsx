import { FormSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ImportLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <FormSkeleton />
    </div>
  );
}
