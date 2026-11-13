import { createSignal, onCleanup, type ComponentProps } from "solid-js"
import { IconButton } from "@opencode/ui/icon-button"
import { Icon } from "@opencode/ui/icon"
import { Tooltip } from "@opencode/ui/tooltip"
import { useI18n } from "@opencode/ui/context/i18n"

// SpeechRecognition is non-standard and only the prefixed form ships in Chromium. The desktop
// renderer (Electron) always exposes webkitSpeechRecognition, so the fallback keeps the browser
// build type-safe without a global ambient declaration.
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

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

/**
 * A push-to-talk dictation control for the composer. Hold to record, release to commit the
 * transcript. Uses the browser's built-in speech recognition, so it needs no provider or key.
 */
export function VoiceDictationButton(
  props: ComponentProps<"button"> & { onTranscript: (text: string) => void; disabled?: boolean },
) {
  const i18n = useI18n()
  const [recording, setRecording] = createSignal(false)
  const [unsupported, setUnsupported] = createSignal(false)
  let recognition: SpeechRecognitionLike | undefined

  const label = () => (recording() ? i18n.t("ui.promptInput.dictate.stop") : i18n.t("ui.promptInput.dictate"))

  const commit = (text: string) => {
    const trimmed = text.trim()

    if (trimmed) props.onTranscript(trimmed + " ")
  }

  const begin = () => {
    if (recording() || unsupported()) return
    recognition ??= recognitionFor(i18n.locale() ?? "en-US")

    if (!recognition) {
      setUnsupported(true)

      return
    }

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1]

      if (result?.isFinal) commit(result[0]?.transcript ?? "")
    }
    recognition.onerror = () => setRecording(false)
    recognition.onend = () => setRecording(false)

    setRecording(true)
    recognition.start()
  }

  const end = () => {
    if (!recording()) return
    setRecording(false)
    recognition?.stop()
  }

  onCleanup(() => recognition?.stop())

  return (
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
  )
}
