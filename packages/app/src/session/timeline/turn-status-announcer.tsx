import type { Accessor } from "solid-js"

/**
 * The single polite live region that names the running turn's phase. It stays mounted while the session is routed, so
 * a screen reader announces each phase as the turn moves from thinking to running commands to responding.
 */
export function TurnStatusAnnouncer(props: { status: Accessor<string> }) {
  return (
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {props.status()}
    </p>
  )
}
