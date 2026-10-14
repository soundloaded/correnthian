import { lazy, Suspense } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardKpi } from "@/components/dashboard/dashboard-kpi"

// -----------------------------------------------------------------------------
// Lazy loaded components
// -----------------------------------------------------------------------------

const PipelinePulseCard = lazy(() =>
  import("@/components/dashboard/pipeline-pulse-card").then((module) => ({
    default: module.PipelinePulseCard,
  })),
)

const DealVelocityCard = lazy(() =>
  import("@/components/dashboard/deal-velocity-card").then((module) => ({
    default: module.DealVelocityCard,
  })),
)

const SourcedPipeline = lazy(() =>
  import("@/components/dashboard/sourced-pipeline").then((module) => ({
    default: module.SourcedPipeline,
  })),
)

const LifecycleCard = lazy(() =>
  import("@/components/dashboard/lifecycle-card").then((module) => ({
    default: module.LifecycleCard,
  })),
)

const SalesOverviewCard = lazy(() =>
  import("@/components/dashboard/sales-overview-card").then((module) => ({
    default: module.SalesOverviewCard,
  })),
)

const TopRegionsCard = lazy(() =>
  import("@/components/dashboard/top-regions-card").then((module) => ({
    default: module.TopRegionsCard,
  })),
)

const UpcomingTasksCard = lazy(() =>
  import("@/components/dashboard/upcoming-tasks-card").then((module) => ({
    default: module.UpcomingTasksCard,
  })),
)

// -----------------------------------------------------------------------------
// Loading component
// -----------------------------------------------------------------------------

function DashboardCardLoader({
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

// -----------------------------------------------------------------------------
// Route
// -----------------------------------------------------------------------------

export const Route = createFileRoute("/_admin/dashboard")({
  component: DashboardPage,
})

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <DashboardHeader />

      <DashboardKpi />

      <div className="grid grid-cols-12 gap-4">
        {/* ------------------------------------------------------------------ */}
        {/* Primary analytics */}
        {/* ------------------------------------------------------------------ */}

        <div className="col-span-12 xl:col-span-6">
          <Suspense fallback={<DashboardCardLoader className="h-[500px]" />}>
            <PipelinePulseCard />
          </Suspense>
        </div>

        <div className="col-span-12 xl:col-span-6">
          <div className="flex flex-col gap-4">
            <Suspense fallback={<DashboardCardLoader />}>
              <DealVelocityCard />
            </Suspense>

            <Suspense fallback={<DashboardCardLoader />}>
              <SourcedPipeline />
            </Suspense>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Secondary analytics */}
        {/* ------------------------------------------------------------------ */}

        <div className="col-span-12 xl:col-span-4">
          <div className="flex flex-col gap-4">
            <Suspense fallback={<DashboardCardLoader />}>
              <LifecycleCard />
            </Suspense>

            <Suspense fallback={<DashboardCardLoader />}>
              <SalesOverviewCard />
            </Suspense>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <Suspense fallback={<DashboardCardLoader />}>
            <TopRegionsCard />
          </Suspense>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <Suspense fallback={<DashboardCardLoader />}>
            <UpcomingTasksCard />
          </Suspense>
        </div>
      </div>
    </div>
  )
}