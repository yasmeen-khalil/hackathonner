"use client";
import { useRef, useState } from "react";
import jsQR from "jsqr";

/** Upload or photograph QR codes (the card on the table, a slide, a poster). Decoded links are handed back. No AI involved: QR decoding is deterministic. */
export default function QrDrop({ onLinks }: { onLinks: (links: string[], notes: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function decode(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const links: string[] = [], notes: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const bmp = await createImageBitmap(f);
        // Try the full image, then a 2x downscale: phone photos are often too large for a clean decode.
        const sizes = [1, 0.5, 0.25];
        let found: string | null = null;
        for (const s of sizes) {
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
          const ctx = c.getContext("2d")!; ctx.drawImage(bmp, 0, 0, c.width, c.height);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
          if (r?.data) { found = r.data; break; }
        }
        if (!found) notes.push(`${f.name}: no QR code found. Try a closer, straighter photo.`);
        else if (/^https?:\/\//i.test(found)) links.push(found);
        else notes.push(`${f.name}: QR code holds text, not a link: "${found.slice(0, 80)}"`);
      } catch { notes.push(`${f.name}: could not read this image.`); }
    }
    onLinks(links, notes);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="rounded border border-dashed border-neutral-300 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="rounded border border-neutral-900 px-3 py-1.5 disabled:opacity-40">{busy ? "Reading…" : "Add from a QR code photo"}</button>
        <span className="text-xs text-neutral-500">Snap the card on your table, a slide, or a poster. The links inside the codes are added above.</span>
      </div>
      <input ref={input} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={e => decode(e.target.files)} />
    </div>
  );
}
