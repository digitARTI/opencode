import { createSignal, onCleanup, type ComponentProps } from "solid-js"
import { IconButton } from "@opencode/ui/icon-button"
import { Icon } from "@opencode/ui/icon"
import { Tooltip } from "@opencode/ui/tooltip"
import { useI18n } from "@opencode/ui/context/i18n"

// SpeechRecognition is non-standard and only the prefixed form ships in Chromium. The desktop
// renderer (Electron) always exposes webkitSpeechRecognition, so the fallback keeps the browser
// build type-safe without a global ambient declaration.
type SpeechRecognitionResultEvent = {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type DictationState =
  | { status: "idle" }
  | { status: "recording" }
  | { status: "error"; kind: "unsupported" | "denied" | "network" | "failed" }

function recognitionFor(lang: string): SpeechRecognitionLike | undefined {
  const scope = globalThis as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition

  if (!Ctor) return undefined
  const recognition = new Ctor()
  recognition.lang = lang
  recognition.interimResults = false
  recognition.continuous = false

  return recognition
}

function errorKind(error: string): "denied" | "network" | "failed" {
  if (error === "not-allowed" || error === "service-not-allowed") return "denied"
  if (error === "network") return "network"

  return "failed"
}

/**
 * A push-to-talk dictation control for the composer. Hold to record, release to commit the
 * transcript. Uses the browser's built-in speech recognition, so it needs no provider or key.
 * The current state is announced through a polite live region; errors explain how to recover.
 */
export function VoiceDictationButton(
  props: ComponentProps<"button"> & { onTranscript: (text: string) => void; disabled?: boolean },
) {
  const i18n = useI18n()
  const [state, setState] = createSignal<DictationState>({ status: "idle" })
  let recognition: SpeechRecognitionLike | undefined
  let errorTimer: ReturnType<typeof setTimeout> | undefined

  const recording = () => state().status === "recording"
  const unsupported = () => {
    const current = state()

    return current.status === "error" && current.kind === "unsupported"
  }

  const statusLabel = () => {
    const current = state()

    if (current.status === "recording") return i18n.t("ui.promptInput.dictate.listening")
    if (current.status === "error") return i18n.t(`ui.promptInput.dictate.error.${current.kind}`)

    return ""
  }

  const label = () => (recording() ? i18n.t("ui.promptInput.dictate.stop") : i18n.t("ui.promptInput.dictate"))

  const fail = (kind: "unsupported" | "denied" | "network" | "failed") => {
    clearTimeout(errorTimer)
    setState({ status: "error", kind })
    // Clear the error after a few seconds so the control returns to its resting state.
    errorTimer = setTimeout(() => setState({ status: "idle" }), 6000)
  }

  const commit = (text: string) => {
    const trimmed = text.trim()

    if (trimmed) props.onTranscript(trimmed + " ")
  }

  const begin = () => {
    if (recording() || props.disabled) return
    recognition ??= recognitionFor(i18n.locale() ?? "en-US")

    if (!recognition) return fail("unsupported")

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1]

      if (result?.isFinal) commit(result[0]?.transcript ?? "")
    }
    recognition.onerror = (event) => {
      // "no-speech" and "aborted" are benign (the user was silent or released); treat them as idle.
      if (event.error === "no-speech" || event.error === "aborted") return setState({ status: "idle" })
      fail(errorKind(event.error))
    }
    recognition.onend = () => setState((current) => (current.status === "error" ? current : { status: "idle" }))

    setState({ status: "recording" })
    recognition.start()
  }

  const end = () => {
    if (!recording()) return
    setState({ status: "idle" })
    recognition?.stop()
  }

  onCleanup(() => {
    clearTimeout(errorTimer)
    recognition?.stop()
  })

  return (
    <span class="relative inline-flex">
      <Tooltip value={label()}>
        <IconButton
          type="button"
          size="normal"
          variant="ghost-muted"
          data-action="composer-dictate"
          aria-label={label()}
          aria-pressed={recording()}
          disabled={props.disabled || unsupported()}
          icon={<Icon name={recording() ? "waveform" : "outline-wave-audio"} size="small" />}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            begin()
          }}
          onPointerUp={() => end()}
          onPointerLeave={() => end()}
        />
      </Tooltip>
      {/* Polite status region so screen readers announce recording and errors. */}
      <span class="sr-only" role="status" aria-live="polite">
        {statusLabel()}
      </span>
    </span>
  )
}
