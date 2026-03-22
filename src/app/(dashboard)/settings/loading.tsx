import { FormSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-16" />
      <div className="flex gap-4 border-b border-gray-200 pb-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-20" />)}
      </div>
      <FormSkeleton />
    </div>
  );
}
