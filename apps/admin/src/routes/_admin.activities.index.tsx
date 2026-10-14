
"use client"

import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { ActivitiesHeader } from "@/components/activities/activities-header"
import {
  ActivitiesToolbar,
  type ActivityFilters,
} from "@/components/activities/activities-toolbar"
import {
  ActivitiesTabs,
  type ActivityTab,
} from "@/components/activities/activities-tabs"
import { ActivitiesList } from "@/components/activities/activities-list"
import { CreateActivitySheet } from "@/components/activities/create-activity-sheet"
import { ActivityDetailsSheet } from "@/components/activities/activity-details-sheet"
import { ActivityDeleteDialog } from "@/components/activities/activity-delete-dialog"
import { useActivities } from "@/components/activities/use-activities"

import type { Activity } from "@/components/activities/activity-data"

const defaultFilters: ActivityFilters = {
  type: "all",
  status: "all",
  date: "all",
}

function getLocalDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getDateOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return getLocalDateString(date)
}

function ActivitiesPage() {
  const {
    activities,
    createActivity,
    completeActivity,
    deleteActivity,
  } = useActivities()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null
  )

  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<ActivityTab>("all")
  const [filters, setFilters] = useState<ActivityFilters>(defaultFilters)

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.date !== "all"

  const matchesSearch = (activity: Activity, search: string) => {
    if (!search) return true

    return (
      activity.title.toLowerCase().includes(search) ||
      activity.description.toLowerCase().includes(search) ||
      activity.owner.toLowerCase().includes(search) ||
      (activity.relatedTo?.name.toLowerCase().includes(search) ?? false)
    )
  }

  const matchesToolbarFilters = (
    activity: Activity,
    today: string,
    next7Days: string,
    past7Days: string,
    search: string
  ) => {
    const matchesType =
      filters.type === "all" || activity.type === filters.type

    const matchesStatus =
      filters.status === "all" || activity.status === filters.status

    let matchesDate = true

    if (filters.date === "today") {
      matchesDate = activity.date === today
    } else if (filters.date === "next7days") {
      matchesDate = activity.date > today && activity.date <= next7Days
    } else if (filters.date === "past7days") {
      matchesDate = activity.date < today && activity.date >= past7Days
    }

    return (
      matchesSearch(activity, search) &&
      matchesType &&
      matchesStatus &&
      matchesDate
    )
  }

  const filteredActivities = useMemo(() => {
    const today = getLocalDateString(new Date())
    const next7Days = getDateOffset(7)
    const past7Days = getDateOffset(-7)
    const search = searchQuery.trim().toLowerCase()

    return activities.filter((activity) => {
      const matchesFilters = matchesToolbarFilters(
        activity,
        today,
        next7Days,
        past7Days,
        search
      )

      const matchesTab =
        activeTab === "all" || activity.status === activeTab

      return matchesFilters && matchesTab
    })
  }, [activities, searchQuery, filters, activeTab])

  const tabCounts = useMemo(() => {
    const today = getLocalDateString(new Date())
    const next7Days = getDateOffset(7)
    const past7Days = getDateOffset(-7)
    const search = searchQuery.trim().toLowerCase()

    const matchingActivities = activities.filter((activity) =>
      matchesToolbarFilters(
        activity,
        today,
        next7Days,
        past7Days,
        search
      )
    )

    return {
      all: matchingActivities.length,
      Upcoming: matchingActivities.filter(
        (activity) => activity.status === "Upcoming"
      ).length,
      Overdue: matchingActivities.filter(
        (activity) => activity.status === "Overdue"
      ).length,
      Completed: matchingActivities.filter(
        (activity) => activity.status === "Completed"
      ).length,
    } satisfies Record<ActivityTab, number>
  }, [activities, searchQuery, filters])

  const handleViewActivity = (activity: Activity) => {
    setSelectedActivity(activity)
    setIsDetailsOpen(true)
  }

  const handleRequestDelete = (activity: Activity) => {
    setSelectedActivity(activity)
    setIsDeleteOpen(true)
  }

  const handleConfirmDelete = (activity: Activity) => {
    deleteActivity(activity)
    setSelectedActivity(null)
  }

  const handleCompleteActivity = (activity: Activity) => {
    completeActivity(activity)
    setSelectedActivity(null)
    setIsDetailsOpen(false)
  }

  const clearFilters = () => {
    setSearchQuery("")
    setFilters(defaultFilters)
    setActiveTab("all")
  }

  return (
    <div className="space-y-6">
      <ActivitiesHeader
        onCreate={() => setIsCreateOpen(true)}
      />

      <ActivitiesToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      <ActivitiesTabs
        value={activeTab}
        onValueChange={setActiveTab}
        counts={tabCounts}
      />

      <ActivitiesList
        activities={filteredActivities}
        onView={handleViewActivity}
        onComplete={completeActivity}
        onDelete={handleRequestDelete}
      />

      <CreateActivitySheet
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreate={createActivity}
      />

      <ActivityDetailsSheet
        activity={selectedActivity}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onComplete={handleCompleteActivity}
      />

      <ActivityDeleteDialog
        activity={selectedActivity}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export const Route = createFileRoute("/_admin/activities/")({
  component: ActivitiesPage,
})