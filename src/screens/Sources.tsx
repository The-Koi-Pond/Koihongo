import { useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";

type Source = { name: string; version: string; license: string; url: string; credit: string };

/** Credits for the open datasets; their licences require a screen like this. */
export function Sources({ onExit }: { onExit: () => void }) {
  const [sources, setSources] = useState<Source[]>();
  const [builtAt, setBuiltAt] = useState<string>();

  useEffect(() => {
    tauriDb.all<Source>("SELECT name, version, license, url, credit FROM content.sources ORDER BY rowid").then(setSources);
    tauriDb
      .all<{ value: string }>("SELECT value FROM content.meta WHERE key = 'built_at'")
      .then(([row]) => setBuiltAt(row?.value));
  }, []);

  return (
    <>
      <h1>Sources &amp; licences</h1>
      <p>
        The kanji, dictionary, component and example-sentence data in this app come from these open projects. Thank you to everyone who
        builds them.
      </p>
      <ul className="sources">
        {sources?.map((s) => (
          <li key={s.name} className="card">
            <h2>{s.name}</h2>
            <p>
              {s.credit}
              <br />
              Licence: {s.license} · Version {s.version}
              <br />
              <span className="muted">{s.url}</span>
            </p>
          </li>
        ))}
      </ul>
      <h2>Downloaded when you ask</h2>
      <ul className="sources">
        {/* Not in content.db: Settings → Reading text from manga downloads these, and src-tauri/src/ocr.rs runs them. */}
        <li className="card">
          <h2>Baberu OCR</h2>
          <p>
            The text-reading model, by genshiai-daichi. Its confidence calibration is adapted from manga-ocr-rs by Hideki A. Ikeda and CodeMonkeyNinja
            (MIT).
            <br />
            Licence: Apache-2.0
            <br />
            <span className="muted">https://huggingface.co/genshiai-daichi/baberu-ocr</span>
          </p>
        </li>
        <li className="card">
          <h2>comic-text-and-bubble-detector</h2>
          <p>
            The model that finds the text on a page, by ogkalu.
            <br />
            Licence: Apache-2.0
            <br />
            <span className="muted">https://huggingface.co/ogkalu/comic-text-and-bubble-detector</span>
          </p>
        </li>
        <li className="card">
          <h2>ONNX Runtime</h2>
          <p>
            Runs both models, by Microsoft.
            <br />
            Licence: MIT
            <br />
            <span className="muted">https://onnxruntime.ai</span>
          </p>
        </li>
      </ul>
      {builtAt && <p className="muted">Data last updated {new Date(builtAt).toLocaleDateString()}.</p>}
      <button onClick={onExit}>← Settings</button>
    </>
  );
}
