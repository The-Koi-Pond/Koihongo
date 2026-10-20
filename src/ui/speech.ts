// Japanese text-to-speech through the voices installed in Windows. If no
// Japanese voice is installed, speech is simply unavailable (buttons hide).

import { useEffect, useState } from "react";

function japaneseVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis?.getVoices().find((v) => v.lang.toLowerCase().replace("_", "-").startsWith("ja"));
}

export function speakJapanese(text: string) {
  const voice = japaneseVoice();
  if (!voice) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.85; // a little slower than natural, for learners
  window.speechSynthesis.speak(utterance);
}

/** Whether a Japanese voice is available. Voices load asynchronously, so this can flip to true after mount. */
export function useJapaneseVoice(): boolean {
  const [available, setAvailable] = useState(() => Boolean(japaneseVoice()));
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const update = () => setAvailable(Boolean(japaneseVoice()));
    synth.addEventListener("voiceschanged", update);
    update();
    return () => synth.removeEventListener("voiceschanged", update);
  }, []);
  return available;
}
