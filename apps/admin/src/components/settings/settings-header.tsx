import { SlidersHorizontal } from "lucide-react"

export function SettingsHeader() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Settings
        </h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Operator profile, feature flags, and what the rails look like. Every
        section renders live API data or says it has no backend — nothing
        here is a toggle that saves nowhere.
      </p>
    </div>
  )
}
