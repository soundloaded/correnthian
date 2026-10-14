
import {
  ArrowLeftIcon,
  UserRoundIcon,
} from "lucide-react"

import { createFileRoute, Link } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"

import { contacts } from "@/components/contacts/contacts-data"
import { ContactDetailsHeader } from "@/components/contacts/details/contact-details-header"
import {
  ContactAboutCard,
  ContactInformationCard,
} from "@/components/contacts/details/contact-information-card"
import {
  ContactActivityCard,
  ContactTasksCard,
} from "@/components/contacts/details/contact-activity-cards"
import {
  ContactCompanyCard,
} from "@/components/contacts/details/contact-company-card"

export const Route = createFileRoute("/_admin/contacts/$contactId")({
  component: ContactDetailsPage,
})

function ContactDetailsPage() {
  const { contactId } = Route.useParams()
  const contact = contacts.find((item) => item.id === contactId)

  if (!contact) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <UserRoundIcon className="size-10 text-muted-foreground" />

        <h2 className="text-lg font-semibold">
          Contact not found
        </h2>

        <p className="text-sm text-muted-foreground">
          This contact may have been removed or does not exist.
        </p>

        <Button
          variant="outline"
          render={<Link to="/contacts" />}
        >
          <ArrowLeftIcon className="mr-2 size-4" />
          Back to Contacts
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">

      {/* Profile Header */}
      <ContactDetailsHeader contact={contact} />

      {/* Details Layout */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(320px,1.45fr)_minmax(220px,0.85fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          <ContactInformationCard contact={contact} />
          <ContactAboutCard contact={contact} />
        </div>

        {/* Center Column */}
        <div className="space-y-4">
          <ContactActivityCard />
          <ContactTasksCard />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <ContactCompanyCard contact={contact} />
        </div>
      </div>
    </div>
  )
}