import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { lookupCached } from "@/lib/sampleCache";
import type { AnalyzeRequest } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Real requests measured at 68-110s, and one run of the same worksheet went
 * past 600s: a frontier reasoning model on shared serverless infrastructure
 * has to be loaded before it can think. The default serverless ceiling is well
 * under this, so the demo times out before the model answers unless the
 * deployment allows a longer duration.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!body.imageBase64 && !body.text) {
    return NextResponse.json(
      { error: "Send either a worksheet photo or typed text." },
      { status: 400 },
    );
  }
  if (!body.language) {
    return NextResponse.json({ error: "Pick a language." }, { status: 400 });
  }

  // Pre-rendered demo worksheets short-circuit here. Exact match only, on text
  // + language + country: edit one character, switch language, or upload a
  // photo and the request goes to the live model like any other. See
  // lib/sampleCache.ts for why this exists and README for the disclosure.
  if (body.text && !body.bypassCache) {
    const hit = lookupCached(body.text, body.language, body.schoolingCountry);
    if (hit) {
      return NextResponse.json({ analysis: hit, provider: "cache", cached: true });
    }
  }

  try {
    const provider = getProvider();
    const analysis = await provider.analyze(body);
    return NextResponse.json({ analysis, provider: provider.name, cached: false });
  } catch (error) {
    // Surface the real reason. A parent gets a friendly message from the UI,
    // but a judge opening the network tab during evaluation should be able to
    // tell a missing API key from a model failure.
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error("[analyze]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
