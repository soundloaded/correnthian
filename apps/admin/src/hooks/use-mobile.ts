import * as React from "react"

/**
 * The block shipped a useEffect + setState mirror, which trips
 * react-hooks/set-state-in-effect and causes a cascading render on mount.
 * The media query is external state, so useSyncExternalStore reads it
 * directly instead of copying it into React state.
 */
const MOBILE_BREAKPOINT = 768

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches,
    () => false,
  )
}
