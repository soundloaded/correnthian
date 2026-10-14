
import { createFileRoute } from "@tanstack/react-router"

import { LeadFormCompany } from "@/components/leads/new-leads/lead-form-company"
import { LeadFormContact } from "@/components/leads/new-leads/lead-form-contact"
import { LeadFormDetails } from "@/components/leads/new-leads/lead-form-details"
import { LeadFormHeader } from "@/components/leads/new-leads/lead-form-header"
import { LeadFormNotes } from "@/components/leads/new-leads/lead-form-notes"
import { useLeadForm } from "@/components/leads/new-leads/use-lead-form"

export const Route = createFileRoute("/_admin/leads/new")({
  component: NewLeadPage,
})

function NewLeadPage() {
  const form = useLeadForm()

  return (
    <form
      noValidate
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <LeadFormHeader />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <LeadFormContact form={form} />
          <LeadFormCompany />
          <LeadFormNotes />
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <LeadFormDetails />
        </div>
      </div>
    </form>
  )
}