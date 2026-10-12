# Runbook: screening vendor incident (Persona down / webhook storm)

## Symptoms

- `POST /compliance/verification/start` answers 503 `provider_unavailable`
  ("Verification is temporarily unavailable")
- Webhook endpoint 401 spike (unsigned or mis-signed deliveries)
- `compliance.rescreen-stale` failing; review queue not growing

## What the system does on its own

- Fail-closed throughout: unknown screens deny, absent screens deny, the
  fiat gate refuses with `screening_unavailable` rather than waving through.
  A Persona outage freezes onboarding and fiat movement — it never opens them.
- Webhook idempotency (`@@unique([provider, eventId])`) makes redelivered
  events no-ops; a storm replays safely.
- Stale/duplicate/out-of-order events are ordered by envelope time; the
  rescreen job retries users the outage skipped.

## Respond

1. **Check vendor status first**, then our `GET /jobs` board for the
   rescreen job's last error.
2. **Do not bypass the gate.** There is no legitimate "approve everyone
   while Persona is down" path — a parked queue that waits is the design.
3. **Signature failures:** verify the webhook secret rotation state
   (rotation pairs) before assuming attack; a just-rotated secret explains
   a 401 burst. Replay a sample delivery only against a scratch receiver.
4. **After recovery:** run `compliance.rescreen-stale` manually once (Jobs →
   Run now) to clear the backlog, then confirm the review queue drains by
   decisions, not by expiry.

## Escalate when

- Suspected forged webhooks (valid shape, invalid signature, at volume):
  treat as a security incident — rotate the webhook secret, preserve the
  payloads, owner + counsel.
- Outage >24h: the rescreen TTL means every screen is stale; announce the
  onboarding freeze plainly rather than letting users discover it.
