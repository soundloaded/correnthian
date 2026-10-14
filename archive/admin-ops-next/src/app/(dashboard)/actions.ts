'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Contract } from '@correnthian/contracts';
import { apiFetch, apiSend } from '@/lib/api-server';
import { apiUrl } from '@/lib/api-url';
import { roleAtLeast } from '@/lib/roles';
import { clearSession, getSession, getToken } from '@/lib/session';

export interface ActionState {
  ok?: boolean;
  error?: string;
}

/** Revoke server-side when possible, then drop the cookie regardless. */
export async function logoutAction(): Promise<void> {
  const token = await getToken();
  if (token) {
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => null);
  }
  await clearSession();
  redirect('/login');
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/**
 * Shared guard for every mutation.
 *
 * The API enforces roles independently — this is the UI half, so a support
 * agent is not shown a button that will only bounce. Both checks exist on
 * purpose: the server's is the real one.
 */
async function guard(required: string): Promise<ActionState | true> {
  const session = await requireSession();
  if (!roleAtLeast(session.role, required)) {
    return { error: `Your role (${session.role}) does not permit this action.` };
  }
  return true;
}

function toState(r: { status: string; message?: string }): ActionState {
  if (r.status === 'ok') return { ok: true };
  if (r.status === 'unauthorised') return { error: 'Your session expired. Sign in again.' };
  return { error: r.message ?? 'The change was not applied.' };
}

export interface AccountHit {
  id: string;
  email: string;
  role: string;
}

type UserList = Contract<'GET /api/v1/users'>;

/**
 * Live account lookup for the header palette. Read-only and scoped to the
 * signed-in console session — the shell is already gated, and the API
 * enforces roles on the call itself. Short queries return nothing rather
 * than the first N accounts, so typing one letter never dumps the directory.
 */
export async function searchAccounts(
  query: string,
): Promise<{ ok: true; items: AccountHit[] } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Your session expired. Sign in again.' };

  const q = query.trim().slice(0, 200);
  if (q.length < 2) return { ok: true, items: [] };

  const result = await apiFetch<UserList>(`/users?search=${encodeURIComponent(q)}&limit=6`);
  if (result.status !== 'ok') return { ok: false, error: 'Account lookup failed. Try again.' };
  return {
    ok: true,
    items: result.data.items.map((u) => ({ id: u.id, email: u.email, role: u.role })),
  };
}

// --- users -----------------------------------------------------------------

export async function changeUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('admin');
  if (allowed !== true) return allowed;

  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!userId || !role) return { error: 'Missing user or role.' };

  const result = await apiSend(`/users/${encodeURIComponent(userId)}/role`, 'PATCH', { role });
  const state = toState(result);
  if (state.ok) revalidatePath('/users');
  return state;
}

export async function changeUserStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('admin');
  if (allowed !== true) return allowed;

  const userId = String(formData.get('userId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!userId || !status) return { error: 'Missing user or status.' };

  const result = await apiSend(`/users/${encodeURIComponent(userId)}/status`, 'PATCH', { status });
  const state = toState(result);
  if (state.ok) revalidatePath('/users');
  return state;
}

// --- assets ----------------------------------------------------------------

export async function setAssetEnabledAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('admin');
  if (allowed !== true) return allowed;

  const assetId = String(formData.get('assetId') ?? '');
  const enabled = String(formData.get('enabled')) === 'true';
  if (!assetId) return { error: 'Missing asset.' };

  const result = await apiSend(
    `/assets/${encodeURIComponent(assetId)}/enabled`, 'PATCH', { enabled },
  );
  const state = toState(result);
  if (state.ok) revalidatePath('/assets');
  return state;
}

export async function recordAttestationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('compliance');
  if (allowed !== true) return allowed;

  const assetId = String(formData.get('assetId') ?? '');
  const attestedAt = String(formData.get('attestedAt') ?? '');
  const proofUrl = String(formData.get('proofUrl') ?? '').trim();
  if (!assetId || !attestedAt) return { error: 'Missing asset or attestation date.' };

  const result = await apiSend(`/assets/${encodeURIComponent(assetId)}/attestation`, 'PATCH', {
    attestedAt: new Date(attestedAt).toISOString(),
    ...(proofUrl ? { proofUrl } : {}),
  });
  const state = toState(result);
  if (state.ok) revalidatePath('/assets');
  return state;
}

// --- issuers ---------------------------------------------------------------

export async function setIssuerTierAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('compliance');
  if (allowed !== true) return allowed;

  const slug = String(formData.get('slug') ?? '');
  const tier = String(formData.get('tier') ?? '');
  const custodian = String(formData.get('custodian') ?? '').trim();
  const proofOfReserves = String(formData.get('proofOfReserves') ?? '').trim();
  if (!slug || !tier) return { error: 'Missing issuer or tier.' };

  const result = await apiSend(`/issuers/${encodeURIComponent(slug)}/verification`, 'PATCH', {
    tier,
    ...(custodian ? { custodian } : {}),
    ...(proofOfReserves ? { proofOfReserves } : {}),
  });
  const state = toState(result);
  if (state.ok) revalidatePath('/issuers');
  return state;
}

export async function addIssuerRiskFlagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('compliance');
  if (allowed !== true) return allowed;

  const slug = String(formData.get('slug') ?? '');
  const flag = String(formData.get('flag') ?? '').trim();
  if (!slug || !flag) return { error: 'Missing issuer or flag.' };

  const result = await apiSend(
    `/issuers/${encodeURIComponent(slug)}/risk-flags`, 'PATCH', { flag },
  );
  const state = toState(result);
  if (state.ok) revalidatePath('/issuers');
  return state;
}

// --- providers & chains ----------------------------------------------------

export async function setProviderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('admin');
  if (allowed !== true) return allowed;

  const slug = String(formData.get('slug') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!slug || !status) return { error: 'Missing provider or status.' };

  const result = await apiSend(`/providers/${encodeURIComponent(slug)}/status`, 'PATCH', { status });
  const state = toState(result);
  if (state.ok) revalidatePath('/providers');
  return state;
}

export async function setChainEnabledAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('admin');
  if (allowed !== true) return allowed;

  const chainId = String(formData.get('chainId') ?? '');
  const enabled = String(formData.get('enabled')) === 'true';
  if (!chainId) return { error: 'Missing chain.' };

  const result = await apiSend(`/chains/${encodeURIComponent(chainId)}/enabled`, 'PATCH', { enabled });
  const state = toState(result);
  if (state.ok) revalidatePath('/chains');
  return state;
}

// --- compliance reviews ------------------------------------------------------

export async function decideReviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('compliance');
  if (allowed !== true) return allowed;

  const userId = String(formData.get('userId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!userId || (decision !== 'approve' && decision !== 'reject')) {
    return { error: 'Missing user or decision.' };
  }
  // Mirrors the server's `assertReason`: a decision without a stated reason
  // never fires. The server remains the real gate; this keeps the operator
  // from writing a reason into a rejected call.
  if (reason.length < 8) return { error: 'A reason of at least 8 characters is required.' };

  const result = await apiSend(
    `/compliance/reviews/${encodeURIComponent(userId)}/decide`,
    'POST',
    { decision, reason },
  );
  const state = toState(result);
  if (state.ok) revalidatePath('/reviews');
  return state;
}

// --- fee rules ---------------------------------------------------------------

export async function createFeeRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('owner');
  if (allowed !== true) return allowed;

  const str = (k: string) => String(formData.get(k) ?? '').trim();
  const operation = str('operation');
  const kind = str('kind');
  const basis = str('basis');
  const label = str('label');
  const reason = str('reason');
  if (!operation || !kind || !basis || !label) return { error: 'Operation, kind, basis and label are required.' };
  if (reason.length < 8) return { error: 'A reason of at least 8 characters is required.' };

  const body: Record<string, unknown> = { operation, kind, basis, label, reason };
  const rateBps = str('rateBps');
  const fixedUsd = str('fixedUsd');
  if (rateBps !== '') body.rateBps = Number(rateBps);
  if (fixedUsd !== '') body.fixedUsd = fixedUsd;

  const result = await apiSend('/fees/rules', 'POST', body);
  const state = toState(result);
  if (state.ok) revalidatePath('/fees');
  return state;
}

export async function setFeeRuleActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('owner');
  if (allowed !== true) return allowed;

  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id) return { error: 'Missing rule.' };
  if (reason.length < 8) return { error: 'A reason of at least 8 characters is required.' };

  const result = await apiSend(
    `/fees/rules/${encodeURIComponent(id)}`,
    'PATCH',
    { active: String(formData.get('active')) === 'true', reason },
  );
  const state = toState(result);
  if (state.ok) revalidatePath('/fees');
  return state;
}

// --- jobs --------------------------------------------------------------------

export async function runJobAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('admin');
  if (allowed !== true) return allowed;

  const name = String(formData.get('name') ?? '');
  if (!name) return { error: 'Missing job.' };

  const result = await apiSend(`/jobs/${encodeURIComponent(name)}/run`, 'POST', {});
  const state = toState(result);
  if (state.ok) revalidatePath('/jobs');
  return state;
}

// --- jurisdiction rules ------------------------------------------------------

export async function updateJurisdictionRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await guard('admin');
  if (allowed !== true) return allowed;

  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id) return { error: 'Missing rule.' };
  if (reason.length < 8) return { error: 'A reason of at least 8 characters is required.' };

  const bool = (k: string) => {
    const v = formData.get(k);
    return v === null || v === undefined || v === '' ? undefined : String(v) === 'true';
  };
  const body: Record<string, unknown> = { reason };
  for (const k of ['canBuyCrypto', 'canSellCrypto', 'canUseMetals', 'canRedeem', 'kycRequired', 'active']) {
    const v = bool(k);
    if (v !== undefined) body[k] = v;
  }
  const notes = String(formData.get('notes') ?? '');
  if (notes !== '') body.notes = notes;

  const result = await apiSend(`/compliance/rules/${encodeURIComponent(id)}`, 'PATCH', body);
  const state = toState(result);
  if (state.ok) revalidatePath('/jurisdictions');
  return state;
}
