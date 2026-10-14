
import { ProfileSettings } from "@/components/settings/profile-settings"
import type { SettingSection } from "@/components/settings/settings-sidebar"
import { SecuritySettings } from "@/components/settings/security-settings"
import { WorkspaceSettings } from "@/components/settings/workspace-settings"
import { NotificationsSettings } from "@/components/settings/notifications-settings"
import { AppearanceSettings } from "@/components/settings/appearance-settings"
import { PipelineSettings } from "@/components/settings/pipeline-settings"
import { IntegrationsSettings } from "@/components/settings/integrations-settings"
import { BillingSettings } from "@/components/settings/billing-settings"
import { ApiWebhooksSettings } from "@/components/settings/api-webhooks-settings"
import { DataSettings } from "@/components/settings/data-settings"

interface SettingsContentProps {
  activeSection: SettingSection
}

export function SettingsContent({
  activeSection,
}: SettingsContentProps) {
  switch (activeSection) {
    case "profile":
      return <ProfileSettings />

    case "security":
      return <SecuritySettings />

    case "workspace":
      return <WorkspaceSettings />

    case "notifications":
      return <NotificationsSettings />

    case "appearance":
      return <AppearanceSettings />

    case "pipeline":
      return <PipelineSettings />

    case "integrations":
      return <IntegrationsSettings />

    case "billing":
      return <BillingSettings />

    case "api-webhooks":
      return <ApiWebhooksSettings />

    case "data":
      return <DataSettings />

    default:
      return null
  }
}
