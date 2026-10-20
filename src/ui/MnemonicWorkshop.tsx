import { useState } from "react";
import { extractMnemonics, mnemonicOpener, mnemonicSystemPrompt, type MnemonicFocus } from "../ai/prompts.ts";
import type { ItemDetails } from "../items.ts";
import { AiChat } from "./AiChat.tsx";

/** Chat with Claude about a mnemonic; "Use this" saves a suggestion. */
export function MnemonicWorkshop({
  item,
  focus,
  onUse,
  onClose,
}: {
  item: ItemDetails;
  focus: MnemonicFocus;
  onUse: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [used, setUsed] = useState<string>();

  async function use(text: string) {
    await onUse(text);
    setUsed(text);
  }

  return (
    <AiChat
      title="Mnemonic workshop"
      system={mnemonicSystemPrompt(item, focus)}
      opener={mnemonicOpener(item, focus)}
      placeholder="e.g. make it about Pokémon, shorter, use the word 'shin'…"
      footnote="AI suggestions can be wrong; saved ones are marked as AI-written. Runs through your Claude Code login."
      onClose={onClose}
      extras={(reply) =>
        extractMnemonics(reply).map((option) => (
          <div key={option} className="option">
            <button type="button" className={used === option ? "" : "primary"} disabled={used === option} onClick={() => use(option)}>
              {used === option ? "Saved ✓" : "Use this"}
            </button>
            <span>{option}</span>
          </div>
        ))
      }
    />
  );
}
