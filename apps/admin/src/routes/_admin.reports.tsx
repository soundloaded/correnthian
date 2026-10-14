import { lazy, Suspense } from "react"
import { createFileRoute } from "@tanstack/react-router"

const ReportsHeader = lazy(() =>
  import("@/components/reports/reports-header").then((module) => ({
    default: module.ReportsHeader,
  })),
)

const AnalyticsWelcomeBanner = lazy(() =>
  import("@/components/reports/analytics-welcome-banner").then((module) => ({
    default: module.AnalyticsWelcomeBanner,
  })),
)

const MetricsGrid = lazy(() =>
  import("@/components/reports/metrics-grid").then((module) => ({
    default: module.MetricsGrid,
  })),
)

const KpiCards = lazy(() =>
  import("@/components/reports/kpi-cards").then((module) => ({
    default: module.KpiCards,
  })),
)

const TopPerformingDealsTable = lazy(() =>
  import("@/components/reports/top-performing-reps").then((module) => ({
    default: module.TopPerformingDealsTable,
  })),
)

const PipelineStageChart = lazy(() =>
  import("@/components/reports/pipeline-stage-chart").then((module) => ({
    default: module.PipelineStageChart,
  })),
)

const LeadSourcesChart = lazy(() =>
  import("@/components/reports/lead-sources-chart").then((module) => ({
    default: module.LeadSourcesChart,
  })),
)

const TeamLeaderboard = lazy(() =>
  import("@/components/reports/team-leaderboard").then((module) => ({
    default: module.TeamLeaderboard,
  })),
)

const TopDeals = lazy(() =>
  import("@/components/reports/top-deals").then((module) => ({
    default: module.TopDeals,
  })),
)

const ChannelPerformance = lazy(() =>
  import("@/components/reports/channel-performance").then((module) => ({
    default: module.ChannelPerformance,
  })),
)

const DealsOutcomeChart = lazy(() =>
  import("@/components/reports/deals-outcome-chart").then((module) => ({
    default: module.DealsOutcomeChart,
  })),
)

export const Route = createFileRoute("/_admin/reports")({
  component: ReportsRoute,
})

function ReportsCardLoader({
  className = "min-h-[280px]",
}: {
  className?: string
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border bg-muted ${className}`}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        Loading...
      </div>
    </div>
  )
}

function ReportsRoute() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <Suspense fallback={<ReportsCardLoader className="min-h-20" />}>
        <ReportsHeader />
      </Suspense>

      <Suspense fallback={<ReportsCardLoader className="min-h-32" />}>
        <AnalyticsWelcomeBanner />
      </Suspense>

      <Suspense fallback={<ReportsCardLoader className="min-h-40" />}>
        <MetricsGrid />
      </Suspense>

      <Suspense fallback={<ReportsCardLoader className="min-h-40" />}>
        <KpiCards />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
  {/* Top Performing Deals Table */}
  <div className="flex grid-cols-1 xl:col-span-8">
    <Suspense fallback={<ReportsCardLoader className="min-h-[400px] w-full" />}>
      <TopPerformingDealsTable />
    </Suspense>
  </div>

  {/* Pipeline Stage Chart */}
  <div className="flex grid-cols-1 xl:col-span-4">
    <Suspense fallback={<ReportsCardLoader className="min-h-[400px] w-full" />}>
      <PipelineStageChart />
    </Suspense>
  </div>

  {/* 3-Card Row: Full width on tablet, 3 columns on xl screen */}
  <div className="flex grid-cols-1 xl:col-span-4">
    <Suspense fallback={<ReportsCardLoader className="min-h-[400px] w-full" />}>
      <LeadSourcesChart />
    </Suspense>
  </div>

  <div className="flex grid-cols-1 xl:col-span-4">
    <Suspense fallback={<ReportsCardLoader className="min-h-[400px] w-full" />}>
      <TeamLeaderboard />
    </Suspense>
  </div>

  <div className="flex grid-cols-1 xl:col-span-4">
    <Suspense fallback={<ReportsCardLoader className="min-h-[400px] w-full" />}>
      <TopDeals />
    </Suspense>
  </div>

  {/* Bottom Row */}
  <div className="flex grid-cols-1 xl:col-span-8">
    <Suspense fallback={<ReportsCardLoader className="min-h-[400px] w-full" />}>
      <ChannelPerformance />
    </Suspense>
  </div>

  <div className="flex grid-cols-1 xl:col-span-4">
    <Suspense fallback={<ReportsCardLoader className="min-h-[400px] w-full" />}>
      <DealsOutcomeChart />
    </Suspense>
  </div>
</div>


    </div>
  )
}