import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function KPICardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white">
      <div className="flex items-center justify-between mb-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white">
      <div className="flex items-center justify-between mb-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-8 w-12" />
      <Skeleton className="h-2 w-24 mt-1" />
    </div>
  );
}

export function StatsOverviewSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 card-spacing">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 grid-spacing-dense">
          {[...Array(5)].map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnnouncementSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-3 rounded-lg border border-slate-200">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3 mt-1" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function QuickActionsSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <Skeleton className="h-5 w-24 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 grid-spacing-dense">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col items-start gap-2">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="section-spacing">
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-9 w-64 mb-1" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Announcements */}
      <AnnouncementSkeleton />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 grid-spacing-dense">
        {[...Array(5)].map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>

      {/* Stats Siswa */}
      <StatsOverviewSkeleton />

      {/* Stats Prestasi */}
      <StatsOverviewSkeleton />

      {/* Quick Actions */}
      <QuickActionsSkeleton />
    </div>
  );
}
