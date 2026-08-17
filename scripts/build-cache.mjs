/**
 * Regenerates lib/sample-cache.json by running the three demo worksheets
 * through the real pipeline with the cache bypassed.
 *
 * Nothing here is hand-written or edited: the stored results are exactly what
 * the live model returned. This removes the wait, not the work. Latency on the
 * reasoning model is wide (68s to over 600s on identical input, because a
 * 753B model has to be resident on a GPU before it can think), so each sample
 * gets several attempts before giving up.
 *
 * Usage:  npm run dev          # in one terminal
 *         npm run build:cache  # in another
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ENDPOINT = process.env.CACHE_ENDPOINT ?? "http://localhost:3000/api/analyze";
const ATTEMPTS = 3;

// Mirrors cacheKey() in lib/sampleCache.ts — keep the two in sync.
function cacheKey(text, language, country) {
  const normalized = text.trim().replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");
  return createHash("sha256")
    .update(`${language}::${country}::${normalized}`)
    .digest("hex")
    .slice(0, 32);
}

// Parse samples straight out of the TS source so there is a single definition
// of each worksheet rather than a copy that can drift out of sync.
const src = readFileSync(new URL("../lib/samples.ts", import.meta.url), "utf8");
const samples = [
  ...src.matchAll(
    /id:\s*"([^"]+)"[\s\S]*?suggestedCountry:\s*"([^"]+)"[\s\S]*?suggestedLanguage:\s*"([^"]+)"[\s\S]*?text:\s*`([\s\S]*?)`,\n/g,
  ),
].map(([, id, country, language, text]) => ({ id, country, language, text }));

if (samples.length === 0) {
  console.error(
    "No samples parsed from lib/samples.ts — aborting rather than writing an empty cache.",
  );
  process.exit(1);
}
console.log(`Parsed ${samples.length} samples\n`);

const out = {};
for (const s of samples) {
  let ok = false;
  for (let attempt = 1; attempt <= ATTEMPTS && !ok; attempt++) {
    process.stdout.write(`  ${s.id} (${s.language}/${s.country}) attempt ${attempt}... `);
    const started = Date.now();
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: s.text,
          language: s.language,
          schoolingCountry: s.country,
          bypassCache: true,
        }),
      });
      const body = await res.json();
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      if (!res.ok || body.error) {
        console.log(`failed after ${secs}s: ${String(body.error).slice(0, 90)}`);
        continue;
      }
      out[cacheKey(s.text, s.language, s.country)] = body.analysis;
      console.log(`ok in ${secs}s`);
      ok = true;
    } catch (e) {
      console.log(`error: ${String(e).slice(0, 90)}`);
    }
  }
  if (!ok) {
    console.log(`  !! ${s.id} not generated — it will fall through to the live model`);
  }
}

writeFileSync(
  new URL("../lib/sample-cache.json", import.meta.url),
  JSON.stringify(out, null, 2) + "\n",
);
console.log(`\nWrote ${Object.keys(out).length}/${samples.length} entries to lib/sample-cache.json`);
