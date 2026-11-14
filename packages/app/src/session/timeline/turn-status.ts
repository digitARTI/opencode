import { createMemo, type Accessor } from "solid-js"
import type { SessionMessageAssistant } from "@opencode/client/promise"
import type { useLanguage } from "@/runtime/i18n/language"

type Translate = ReturnType<typeof useLanguage>["t"]

/** The phrase the announcer speaks for one phase of a running turn. */
type TurnStatusKey =
  | "session.timeline.status.waitingAnswer"
  | "session.timeline.status.waitingApproval"
  | "session.timeline.working"
  | "ui.sessionTurn.status.delegating"
  | "ui.sessionTurn.status.gatheringContext"
  | "ui.sessionTurn.status.makingEdits"
  | "ui.sessionTurn.status.responding"
  | "ui.sessionTurn.status.runningCommands"
  | "ui.sessionTurn.status.searchingCodebase"
  | "ui.sessionTurn.status.searchingWeb"
  | "ui.sessionTurn.status.thinking"

/** The phrase each tool's name stands for while the tool runs. */
const TOOL_STATUS = new Map<string, TurnStatusKey>([
  ["shell", "ui.sessionTurn.status.runningCommands"],
  ["execute", "ui.sessionTurn.status.runningCommands"],
  ["read", "ui.sessionTurn.status.gatheringContext"],
  ["list", "ui.sessionTurn.status.gatheringContext"],
  ["glob", "ui.sessionTurn.status.gatheringContext"],
  ["grep", "ui.sessionTurn.status.searchingCodebase"],
  ["websearch", "ui.sessionTurn.status.searchingWeb"],
  ["webfetch", "ui.sessionTurn.status.searchingWeb"],
  ["edit", "ui.sessionTurn.status.makingEdits"],
  ["write", "ui.sessionTurn.status.makingEdits"],
  ["patch", "ui.sessionTurn.status.makingEdits"],
  ["subagent", "ui.sessionTurn.status.delegating"],
  ["task", "ui.sessionTurn.status.delegating"],
])

/**
 * The phase the running turn is in, translated for the single polite live region. It reads the step's own content,
 * first to last, so an earlier step's thought never outranks what the model is doing now.
 */
export function createTurnStatus(input: {
  /** Whether the session is running a turn. */
  running: Accessor<boolean>
  /** A permission or a form question waits on the user. */
  blocked: Accessor<"approval" | "answer" | undefined>
  /** The assistant message the turn is working on, or the last one it finished. */
  step: Accessor<SessionMessageAssistant | undefined>
  /** The app translator. */
  t: Translate
}) {
  return createMemo(() => {
    if (!input.running()) return ""

    const blocked = input.blocked()

    if (blocked === "approval") return input.t("session.timeline.status.waitingApproval")
    if (blocked === "answer") return input.t("session.timeline.status.waitingAnswer")
    const step = input.step()
    const last = step?.content.at(-1)

    if (last?.type === "reasoning" && last.time?.completed === undefined)
      return input.t("ui.sessionTurn.status.thinking")
    if (last?.type === "tool" && (last.state.status === "running" || last.state.status === "streaming"))
      return input.t(TOOL_STATUS.get(last.name) ?? "ui.sessionTurn.status.runningCommands")
    if (last?.type === "text" && last.text.trim() && step?.time.completed === undefined)
      return input.t("ui.sessionTurn.status.responding")

    return input.t("session.timeline.working")
  })
}
