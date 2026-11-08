"use client"

import { Link } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

// Everything else the operator reaches for from this page: the compliance
// queue, the operator's transaction table, and the audit trail. Plain links,
// not pre-filtered ones — the destinations keep their filters in local state
// and read no URL search, so a `search` param would be silently dropped and
// the operator would land on an unfiltered table believing it filtered.
export function UserRelatedCard() {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold">Related</p>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            nativeButton={false}
            render={<Link to="/compliance" />}
          >
            Compliance queue
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            nativeButton={false}
            render={<Link to="/transactions" />}
          >
            All transactions
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            nativeButton={false}
            render={<Link to="/audit" />}
          >
            Audit trail
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
