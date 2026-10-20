import { Volume2 } from "lucide-react";
import { speakJapanese, useJapaneseVoice } from "./speech.ts";

/** Plays `text` with a Japanese voice; shows `fallback` (default: nothing) if Windows has none installed. */
export function SpeakButton({ text, className = "", fallback = null }: { text: string; className?: string; fallback?: React.ReactNode }) {
  const available = useJapaneseVoice();
  if (!available || !text) return fallback;
  return (
    <button type="button" className={`speak-btn ${className}`} aria-label={`Play ${text}`} title="Play" onClick={() => speakJapanese(text)}>
      <Volume2 size={18} strokeWidth={1.75} />
    </button>
  );
}
