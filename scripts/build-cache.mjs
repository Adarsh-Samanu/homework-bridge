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
import http from "node:http";

/**
 * Node's built-in fetch (undici) applies a 300s header timeout that cannot be
 * raised without pulling in a custom dispatcher, and one of these worksheets
 * took longer than that to generate — it failed with a bare "fetch failed"
 * that looked like a network fault rather than a timeout. node:http has no
 * such default, so requests are made directly.
 */
function postJson(endpoint, payload, timeoutMs = 900_000) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, body: JSON.parse(raw) });
          } catch {
            reject(new Error(`non-JSON response (HTTP ${res.statusCode})`));
          }
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timed out after ${timeoutMs / 1000}s`)));
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

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

const cachePath = new URL("../lib/sample-cache.json", import.meta.url);

/**
 * Start from whatever is already cached rather than an empty object.
 *
 * Each entry costs minutes of live model time, and regenerating all three to
 * add one means a failure part-way can destroy good entries that took four
 * minutes each to produce. Existing entries are kept and skipped; set FORCE=1
 * to regenerate everything deliberately.
 */
const out = (() => {
  try {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  } catch {
    return {};
  }
})();
const FORCE = process.env.FORCE === "1";
console.log(`${Object.keys(out).length} entries already cached${FORCE ? " (FORCE: regenerating all)" : ""}\n`);

function flush() {
  writeFileSync(cachePath, JSON.stringify(out, null, 2) + "\n");
}
for (const s of samples) {
  const key = cacheKey(s.text, s.language, s.country);
  if (!FORCE && out[key]) {
    console.log(`  ${s.id} (${s.language}/${s.country}) already cached — skipping`);
    continue;
  }
  let ok = false;
  for (let attempt = 1; attempt <= ATTEMPTS && !ok; attempt++) {
    process.stdout.write(`  ${s.id} (${s.language}/${s.country}) attempt ${attempt}... `);
    const started = Date.now();
    try {
      const res = await postJson(ENDPOINT, {
        text: s.text,
        language: s.language,
        schoolingCountry: s.country,
        bypassCache: true,
      });
      const body = res.body;
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      if (!res.ok || body.error) {
        console.log(`failed after ${secs}s: ${String(body.error).slice(0, 90)}`);
        continue;
      }
      out[cacheKey(s.text, s.language, s.country)] = body.analysis;
      // Persist immediately. Each entry can take minutes to generate, so
      // losing completed work to a later failure (or a Ctrl-C) is expensive.
      flush();
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

flush();
console.log(`\nWrote ${Object.keys(out).length}/${samples.length} entries to lib/sample-cache.json`);
