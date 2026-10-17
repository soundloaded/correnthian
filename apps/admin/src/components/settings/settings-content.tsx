import { Bell, Flag, Plug, ScrollText, ShieldCheck, UserRound } from "lucide-react"

import { DataSettings, IntegrationsSettings } from "@/components/settings/backend-settings"
import {
  NotificationsSettings,
  ProfileSettings,
  SecuritySettings,
} from "@/components/settings/account-settings"
import { FlagsSettings } from "@/components/settings/flags-settings"
import { NoBackendSection } from "@/components/settings/no-backend-section"
import type { SettingSection } from "@/components/settings/settings-sidebar"

interface SettingsContentProps {
  activeSection: SettingSection
}

// Every section renders against a real endpoint or says it has none.
// Sections with no backend render the honest empty state, never mock
// toggles — a switch that saves nowhere is the mock the rebuild removes.
export function SettingsContent({
  activeSection,
}: SettingsContentProps) {
  switch (activeSection) {
    case "profile":
      return <ProfileSettings />

    case "security":
      return <SecuritySettings />

    case "notifications":
      return <NotificationsSettings />

    case "flags":
      return <FlagsSettings />

    case "integrations":
      return <IntegrationsSettings />

    case "data":
      return <DataSettings />

    case "appearance":
    case "workspace":
    case "pipeline":
    case "billing":
    case "api-webhooks":
      return <NoBackendSection section={activeSection} />

    default:
      return null
  }
}

export const SETTING_SECTION_META = {
  profile: { label: "Profile", icon: UserRound, group: "Account" },
  security: { label: "Security", icon: ShieldCheck, group: "Account" },
  notifications: { label: "Notifications", icon: Bell, group: "Account" },
  flags: { label: "Feature flags", icon: Flag, group: "Workspace" },
  integrations: { label: "Integrations", icon: Plug, group: "Workspace" },
  data: { label: "Data", icon: ScrollText, group: "Workspace" },
} as const
