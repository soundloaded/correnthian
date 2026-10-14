import { createFileRoute } from "@tanstack/react-router"

import { contacts as contactsData } from "@/components/contacts/contacts-data"
import { ContactsHeader } from "@/components/contacts/contacts-header"
import { ContactsTable } from "@/components/contacts/contacts-table"
import { ContactsToolbar } from "@/components/contacts/contacts-toolbar"
import { useContactsTable } from "@/components/contacts/use-contacts-table"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@correnthian/ui/components/alert-dialog"

export const Route = createFileRoute("/_admin/contacts/")({
  component: ContactsPage,
})

function ContactsPage() {
  const contacts = useContactsTable(contactsData)

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <ContactsHeader />

      {/* Search, Filter and Bulk Actions */}
      <ContactsToolbar
        search={contacts.search}
        onSearchChange={contacts.handleSearch}
        status={contacts.status.value}
        onStatusChange={contacts.status.onChange}
        selectedCount={contacts.selectedCount}
        onBulkDelete={contacts.requestBulkDelete}
      />

      {/* Contacts Data Table */}
      <ContactsTable
        table={contacts.table}
        totalCount={contacts.totalCount}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={contacts.dialog.open}
        onOpenChange={contacts.dialog.onOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {contacts.dialog.targets.length}{" "}
              {contacts.dialog.targets.length === 1
                ? "contact"
                : "contacts"}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={contacts.dialog.onConfirm}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}