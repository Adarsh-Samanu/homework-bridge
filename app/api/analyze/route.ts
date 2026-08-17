import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import type { AnalyzeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  try {
    const provider = getProvider();
    const analysis = await provider.analyze(body);
    return NextResponse.json({ analysis, provider: provider.name });
  } catch (error) {
    // Surface the real reason. A parent gets a generic message from the UI, but
    // a judge opening the network tab during evaluation should be able to tell
    // a missing API key from a model failure.
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error("[analyze]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
