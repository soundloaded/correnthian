import { useState } from "react"

import { createFileRoute, notFound } from "@tanstack/react-router"

import { CompanyEditSheet } from "@/components/companies/details/company-edit-sheet.tsx"
import { companies } from "@/components/companies/companies-data"
import { CompanyDetailsHeader } from "@/components/companies/details/company-details-header"
import { CompanyInformationCard } from "@/components/companies/details/company-information-card"
import { CompanyAboutCard } from "@/components/companies/details/company-about-card"
import { CompanyContactsCard } from "@/components/companies/details/company-contacts-card"
import { CompanyDealsCard } from "@/components/companies/details/company-deals-card"
import { CompanyActivityCard } from "@/components/companies/details/company-activity-card"

export const Route = createFileRoute("/_admin/companies/$companyId")({
  loader: ({ params }) => {
    const company = companies.find((c) => c.id === params.companyId)
    if (!company) throw notFound()
    return company
  },
  component: CompanyDetailsPage,
})

function CompanyDetailsPage() {
  const company = Route.useLoaderData()
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="flex flex-1 flex-col gap-4">
      <CompanyDetailsHeader
        company={company}
        onEdit={() => setEditOpen(true)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <CompanyContactsCard company={company} />
          <CompanyDealsCard />
          <CompanyActivityCard />
        </div>

        <div className="space-y-4 lg:col-span-1">
          <CompanyInformationCard company={company} />
          <CompanyAboutCard company={company} />
        </div>
      </div>

      <CompanyEditSheet
        company={company}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  )
}