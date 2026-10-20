"use client"

import * as React from "react"

import { SlidersHorizontalIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { getSession } from "@/lib/auth"
import { rankAtLeast } from "@/lib/roles"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { Input } from "@correnthian/ui/components/input"
import { Label } from "@correnthian/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"
import { Textarea } from "@correnthian/ui/components/textarea"

import {
  actionFor,
  MIN_REASON_LENGTH,
  OBSERVATION_OUTCOMES,
  observationNeedsReason,
  type ObservationOutcome,
  type TxState,
} from "./transaction-actions"
import type { TransactionDetail } from "./transaction-details-header"

/**
 * The two operator moves the API allows from the console.
 *
 * Advancing an edge and recording a chain observation are different claims:
 * the first is the operator's word, the second is a fact read off a chain.
 * The API keeps them apart — `POST /transitions` and `POST /observations` —
 * so the console keeps them apart too.
 *
 * Which edges exist is the server's answer (`permittedNext`); this card only
 * collects the evidence each one carries. The role gate below is
 * display-only — `RolesGuard` and the service decide.
 */
export function TransactionActionsCard({
  tx,
  onChanged,
}: {
  tx: TransactionDetail
  onChanged: () => void
}) {
  const sessionRole = getSession()?.role ?? "user"
  const canAct = rankAtLeast(sessionRole, "support")

  const [target, setTarget] = React.useState<TxState | "">(
    tx.permittedNext[0] ?? "",
  )
  const [hash, setHash] = React.useState(tx.txHash ?? "")
  const [errorCode, setErrorCode] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [advanceError, setAdvanceError] = React.useState<string | null>(null)
  const [advancing, setAdvancing] = React.useState(false)

  const [observedHash, setObservedHash] = React.useState(tx.txHash ?? "")
  const [confirmations, setConfirmations] = React.useState("0")
  const [outcome, setOutcome] = React.useState<ObservationOutcome>("seen")
  const [blockNumber, setBlockNumber] = React.useState("")
  const [observationReason, setObservationReason] = React.useState("")
  const [observeError, setObserveError] = React.useState<string | null>(null)
  const [observing, setObserving] = React.useState(false)

  // A new legal set means the chosen edge may no longer exist; fall back to
  // the first one the server now permits.
  const permitted = tx.permittedNext.join(",")
  React.useEffect(() => {
    setTarget(tx.permittedNext[0] ?? "")
    setAdvanceError(null)
  }, [tx.id, permitted])

  // The row's hash is the one a broadcast must carry, and the one an
  // observation has to match — a row is bound to a hash for life.
  React.useEffect(() => {
    setHash(tx.txHash ?? "")
    setObservedHash(tx.txHash ?? "")
  }, [tx.txHash])

  if (!canAct) {
    return (
      <Card>
        <ActionsCardHeader />
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Moving a transaction needs the support role. Your session is{" "}
            {sessionRole}, so this transaction is read-only for you.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (tx.permittedNext.length === 0) {
    return null
  }

  const spec = target ? actionFor(tx.state, target) : null

  const advance = async () => {
    if (!spec) return
    if (spec.needsTxHash && hash.trim() === "") {
      setAdvanceError("A broadcast needs the transaction hash it is bound to.")
      return
    }
    if (spec.needsReason && reason.trim().length < MIN_REASON_LENGTH) {
      setAdvanceError(
        `This edge moves a settled record backwards, so it needs a reason of at least ${MIN_REASON_LENGTH} characters.`,
      )
      return
    }
    setAdvancing(true)
    setAdvanceError(null)
    const result = await api.request("POST /api/v1/transactions/:id/transitions", {
      params: { id: tx.id },
      body: {
        to: target,
        ...(spec.needsTxHash && hash.trim() ? { txHash: hash.trim() } : {}),
        ...(spec.needsError && errorCode.trim()
          ? { errorCode: errorCode.trim() }
          : {}),
        ...(spec.needsError && errorMessage.trim()
          ? { errorMessage: errorMessage.trim() }
          : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      },
    })
    setAdvancing(false)
    if (result.status !== "ok") {
      setAdvanceError(toMessage(result))
      return
    }
    setErrorCode("")
    setErrorMessage("")
    setReason("")
    onChanged()
  }

  const observe = async () => {
    const depth = Number(confirmations)
    if (observedHash.trim().length < 16) {
      setObserveError("A transaction hash is required — at least 16 characters.")
      return
    }
    if (!Number.isInteger(depth) || depth < 0) {
      setObserveError("Confirmations must be a whole number, zero or more.")
      return
    }
    if (blockNumber.trim() !== "" && !/^\d+$/.test(blockNumber.trim())) {
      setObserveError("A block number is a whole number.")
      return
    }
    if (
      observationNeedsReason(outcome) &&
      observationReason.trim().length < MIN_REASON_LENGTH
    ) {
      setObserveError(
        `A ${outcome} report needs a reason of at least ${MIN_REASON_LENGTH} characters.`,
      )
      return
    }
    setObserving(true)
    setObserveError(null)
    const result = await api.request("POST /api/v1/transactions/:id/observations", {
      params: { id: tx.id },
      body: {
        txHash: observedHash.trim(),
        confirmations: depth,
        outcome,
        ...(blockNumber.trim() ? { blockNumber: blockNumber.trim() } : {}),
        ...(observationReason.trim() ? { reason: observationReason.trim() } : {}),
      },
    })
    setObserving(false)
    if (result.status !== "ok") {
      setObserveError(toMessage(result))
      return
    }
    setBlockNumber("")
    setObservationReason("")
    onChanged()
  }

  return (
    <Card>
      <ActionsCardHeader />
      <CardContent className="space-y-5">
        <section className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Advance the lifecycle
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="tx-target">Move to</Label>
            <Select
              value={target}
              onValueChange={(value) => {
                if (value) setTarget(value as TxState)
              }}
            >
              <SelectTrigger id="tx-target" className="w-full">
                <SelectValue placeholder="Choose a legal next state" />
              </SelectTrigger>
              <SelectContent>
                {tx.permittedNext.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {spec && (
              <p className="text-xs text-muted-foreground">{spec.hint}</p>
            )}
          </div>

          {spec?.needsTxHash && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-hash">Transaction hash</Label>
              <Input
                id="tx-hash"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="0x…"
                className="font-mono"
              />
            </div>
          )}

          {spec?.needsError && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-error-code">Failure code</Label>
              <Input
                id="tx-error-code"
                value={errorCode}
                onChange={(e) => setErrorCode(e.target.value)}
                placeholder="e.g. reverted"
              />
              <Label htmlFor="tx-error-message">What went wrong</Label>
              <Textarea
                id="tx-error-message"
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                rows={2}
                maxLength={500}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tx-reason">
              Reason{spec?.needsReason ? "" : " (optional)"}
            </Label>
            <Textarea
              id="tx-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="What happened, not what you did"
            />
            {spec?.needsReason && (
              <p className="text-xs text-muted-foreground">
                Required here — this edge moves money backwards, and the audit
                trail owes the reason.
              </p>
            )}
          </div>

          {advanceError && (
            <p role="alert" className="text-sm text-destructive">
              {advanceError}
            </p>
          )}

          <Button
            size="sm"
            variant={spec?.destructive ? "destructive" : "default"}
            onClick={advance}
            disabled={advancing || !spec}
          >
            {advancing ? "Saving…" : (spec?.label ?? "Advance")}
          </Button>
        </section>

        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-xs font-medium text-muted-foreground">
            Record a chain observation
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tx-observed-hash">Transaction hash</Label>
              <Input
                id="tx-observed-hash"
                value={observedHash}
                onChange={(e) => setObservedHash(e.target.value)}
                placeholder="0x…"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-confirmations">Confirmations</Label>
              <Input
                id="tx-confirmations"
                type="number"
                min={0}
                value={confirmations}
                onChange={(e) => setConfirmations(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-outcome">Outcome</Label>
              <Select
                value={outcome}
                onValueChange={(value) => {
                  if (value) setOutcome(value as ObservationOutcome)
                }}
              >
                <SelectTrigger id="tx-outcome" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBSERVATION_OUTCOMES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-block-number">Block number (optional)</Label>
              <Input
                id="tx-block-number"
                value={blockNumber}
                onChange={(e) => setBlockNumber(e.target.value)}
                placeholder="21000000"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-observation-reason">
              Reason{observationNeedsReason(outcome) ? "" : " (optional)"}
            </Label>
            <Textarea
              id="tx-observation-reason"
              value={observationReason}
              onChange={(e) => setObservationReason(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          {observeError && (
            <p role="alert" className="text-sm text-destructive">
              {observeError}
            </p>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={observe}
            disabled={observing}
          >
            {observing ? "Recording…" : "Record observation"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ActionsCardHeader() {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="flex items-center gap-2">
        <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Operator actions</p>
      </div>
    </CardHeader>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
