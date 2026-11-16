import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly on admin navigation while the server renders the next page.
export default function AdminLoading() {
  return (
    <div className="p-8 space-y-4">
      <Skeleton className="h-8 w-62.5" />
      <Skeleton className="h-100 w-full" />
    </div>
  );
}
