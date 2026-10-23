import { useState } from "react";
import { extractMnemonics, mnemonicInstructions, mnemonicOpener, type MnemonicFocus } from "../ai/prompts.ts";
import { askDeki } from "../deki/store.ts";
import type { ItemDetails } from "../items.ts";

/** "Ask AI" on a mnemonic: Deki-senpai suggests some in a chat of their own; "Use this" saves one. */
export function askForMnemonics(item: ItemDetails, focus: MnemonicFocus, onUse: (text: string) => Promise<void>) {
  askDeki({
    message: mnemonicOpener(item, focus),
    instructions: mnemonicInstructions(item, focus),
    apart: true,
    actions: (reply) => <MnemonicOptions options={extractMnemonics(reply)} onUse={onUse} />,
  });
}

function MnemonicOptions({ options, onUse }: { options: string[]; onUse: (text: string) => Promise<void> }) {
  const [used, setUsed] = useState<string>();
  const [error, setError] = useState<string>();
  return (
    <>
      {options.map((option) => (
        <div key={option} className="option">
          <button
            type="button"
            className={used === option ? "" : "primary"}
            disabled={used === option}
            onClick={() =>
              onUse(option).then(
                () => setUsed(option),
                (e) => setError(String(e)),
              )
            }
          >
            {used === option ? "Saved ✓" : "Use this"}
          </button>
          <span>{option}</span>
        </div>
      ))}
      {error && <p className="error">{error}</p>}
    </>
  );
}
