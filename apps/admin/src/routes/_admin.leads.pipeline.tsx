import { createFileRoute } from "@tanstack/react-router"

import { leads } from "@/components/leads/leads-data"
import { PipelineBoard } from "@/components/leads/pipeline/pipeline-board"
import { PipelineHeader } from "@/components/leads/pipeline/pipeline-header"
import { PipelineToolbar } from "@/components/leads/pipeline/pipeline-toolbar"

export const Route = createFileRoute("/_admin/leads/pipeline")({
  component: PipelinePage,
})

function PipelinePage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
      <PipelineHeader />
      <PipelineToolbar />
      <PipelineBoard leads={leads} />
    </div>
  )
}