import { createCorrenthianClient, type RegistryPath } from "@correnthian/api-client"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { apiBaseUrl, signOutAndLeave } from "./api"
import { getSession } from "./auth"

/**
 * One query hook for every dashboard card. The shared client returns a
 * discriminated ApiResult, so the hook maps it onto query states: only
 * `ok` resolves data, everything else throws into the error channel the
 * card's failure state already renders. A 401 anywhere drops the session
 * and leaves — a revoked token must never keep a shell rendered.
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
        onUnauthorised: () => signOutAndLeave(),
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
