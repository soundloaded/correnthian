"use client"

import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@correnthian/ui/components/avatar"

/**
 * Deterministic account avatar: RoboHash set keyed by account id, with the
 * initials fallback underneath while it loads and if it fails. No personal
 * data leaves the browser — the set string is derived from the row id, not
 * the email, so no hash of a PII value is ever requested.
 */
export function AccountAvatar({
  accountId,
  title,
  className,
}: {
  accountId: string
  title: string
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)
  const src = failed
    ? undefined
    : `https://robohash.org/${encodeURIComponent(accountId)}?set=set4&size=96x96`

  return (
    <Avatar className={className ?? "size-9"}>
      {src && (
        <AvatarImage src={src} alt="" onError={() => setFailed(true)} />
      )}
      <AvatarFallback className="text-xs">
        {initials(title)}
      </AvatarFallback>
    </Avatar>
  )
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
