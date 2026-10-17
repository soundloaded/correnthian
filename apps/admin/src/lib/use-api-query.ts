import { createCorrenthianClient, type RegistryPath } from "@correnthian/api-client"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { apiBaseUrl, signOutAndLeave } from "./api"
import { getSession } from "./auth"

/**
 * One query hook for every console read. The shared client returns a
 * discriminated ApiResult, so the hook maps it onto query states: only
 * `ok` resolves data, everything else throws into the error channel the
 * card's failure state already renders.
 *
 * A 401 here drops the session and leaves — with one narrow exception.
 * TanStack fires queryFns for mounted components during the same commit
 * that a sign-out clears storage (logout click, expiry tick, another tab):
 * the in-flight call then goes out with no token, gets the 401 it asked
 * for, and must NOT resurrect a redirect loop or wipe anything further.
 * So the handler checks the session first: a 401 with no stored session is
 * an echo of a sign-out already in progress, and the query simply fails
 * into its error state. Only a 401 that arrives while a session is still
 * stored proves the server rejected a live token — that is the revoked
 * case, and only that case signs out. Either way a revoked token never
 * keeps a shell rendered: the shell gate re-checks storage on the next
 * navigation.
 */
export function useApiQuery<Path extends RegistryPath>(
  key: Path,
  params?: Record<string, string | number>,
  query?: Record<string, string | number | boolean | undefined | null>,
): UseQueryResult<import("@correnthian/api-client").Contract<Path>, Error> {
  return useQuery({
    queryKey: [key, params, query],
    queryFn: async () => {
      const client = createCorrenthianClient({
        baseUrl: apiBaseUrl,
        getToken: () => getSession()?.token ?? null,
        onUnauthorised: () => {
          // Echo guard: only a stored session proves the server rejected a
          // live token. Without one this 401 is the wake of a sign-out, and
          // firing the global leave would loop the login redirect.
          if (getSession()) signOutAndLeave()
        },
      })
      const result = await client.request(key, {
        ...(params ? { params } : {}),
        ...(query ? { query } : {}),
      })
      if (result.status === "ok") return result.data
      throw new Error(
        result.status === "unauthorised"
          ? "Your session expired. Sign in again."
          : result.status === "forbidden"
            ? result.message
            : result.status === "unavailable"
              ? "Cannot reach the Correnthian API. It may be starting, or stopped."
              : result.message,
      )
    },
    staleTime: 30_000,
    retry: 1,
  })
}
