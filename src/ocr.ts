// Reading the text in a box on a manga page ("Read text") and finding the
// text on a page ("Find text"), with models on your PC (src-tauri/src/ocr.rs).
// The models are an optional download, set up in Settings.

import { Channel, invoke } from "@tauri-apps/api/core";
import { aiComplete } from "./ai/ai.ts";
import { READ_IMAGE_SYSTEM, readImagePrompt, readImageReply } from "./ai/prompts.ts";
import { tidyRead, type Box, type FoundText } from "./reading.ts";

export type OcrStatus = { installed: boolean; /** The download's size in bytes. */ size: number };
export type OcrText = { text: string; /** 0–1: how sure the model is. */ confidence: number };

export const ocrStatus = () => invoke<OcrStatus>("ocr_status");

/** Downloads the model, calling `onProgress` with bytes done and the total as it goes. */
export async function downloadOcr(onProgress: (done: number, total: number) => void): Promise<void> {
  const channel = new Channel<{ done: number; total: number }>();
  channel.onmessage = (p) => onProgress(p.done, p.total);
  await invoke("ocr_download", { onProgress: channel });
}

export const removeOcr = () => invoke<void>("ocr_remove");

/** A box of the page image as PNG bytes, at the page's full resolution. */
export async function cutOut(url: string, box: Box): Promise<Uint8Array> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const [x, y] = [Math.round(box.x * img.naturalWidth), Math.round(box.y * img.naturalHeight)];
  const [w, h] = [Math.max(1, Math.round(box.w * img.naturalWidth)), Math.max(1, Math.round(box.h * img.naturalHeight))];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, w, h);
  const png = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  if (!png) throw new Error("Couldn't cut the box out of the page.");
  return new Uint8Array(await png.arrayBuffer());
}

/** A box of the page as a small JPEG data: URL (for a card's picture), at most `maxSide` pixels across. */
export async function pictureOf(url: string, box: Box, maxSide = 480): Promise<string> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const [x, y, w, h] = [box.x * img.naturalWidth, box.y * img.naturalHeight, box.w * img.naturalWidth, box.h * img.naturalHeight];
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** The text in a mark's boxes read by Deki-senpai from their pictures (one request a box, joined in box order). */
export async function readBoxesWithAi(url: string, boxes: Box[], kind: string): Promise<string> {
  const parts: string[] = [];
  for (const box of boxes) {
    const png = await cutOut(url, box);
    let binary = "";
    for (const b of png) binary += String.fromCharCode(b);
    const reply = await aiComplete({ system: READ_IMAGE_SYSTEM, messages: [{ role: "user", text: readImagePrompt(kind) }], image: btoa(binary) });
    parts.push(readImageReply(reply));
  }
  return tidyRead(parts.join(""));
}

/** The text in a mark's boxes (a bubble in two parts reads as one text, in box order). */
export async function readBoxes(url: string, boxes: Box[]): Promise<OcrText> {
  const parts: OcrText[] = [];
  for (const box of boxes) parts.push(await invoke<OcrText>("ocr_read", await cutOut(url, box)));
  return { text: tidyRead(parts.map((p) => p.text).join("")), confidence: Math.min(...parts.map((p) => p.confidence)) };
}

/** Finds the text areas on a page (comic-text-and-bubble-detector), and whether the page is a two-page spread. */
export async function findText(url: string): Promise<{ found: FoundText[]; spread: boolean }> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const found = await invoke<FoundText[]>("ocr_find", await cutOut(url, { x: 0, y: 0, w: 1, h: 1 }));
  return { found, spread: img.naturalWidth > img.naturalHeight };
}
