import OpenAI from "openai";
import { ANALYSIS_SCHEMA } from "../schema";
import { buildSystemPrompt, buildUserPrompt } from "../prompt";
import type { AnalyzeRequest, WorksheetAnalysis } from "../types";

/**
 * Featherless AI exposes an OpenAI-compatible endpoint, so the official
 * `openai` client works unchanged against their base URL.
 *
 * FEATHERLESS_VISION_MODEL must name a model that actually accepts image
 * input. Featherless hosts a large open-model catalog and the exact ids change,
 * so this is configuration rather than a constant — check the current catalog
 * before deploying. A text-only model here fails at request time, not at build.
 */
function client(): OpenAI {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "FEATHERLESS_API_KEY is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.FEATHERLESS_BASE_URL ?? "https://api.featherless.ai/v1",
  });
}

export async function analyzeWithFeatherless(
  req: AnalyzeRequest,
): Promise<WorksheetAnalysis> {
  const model = process.env.FEATHERLESS_VISION_MODEL;
  if (!model) {
    throw new Error(
      "FEATHERLESS_VISION_MODEL is not set. It must name an image-capable model from the Featherless catalog.",
    );
  }

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: "text", text: buildUserPrompt(req) },
  ];

  if (req.imageBase64) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${req.imageMediaType ?? "image/jpeg"};base64,${req.imageBase64}`,
      },
    });
  }

  const completion = await client().chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [
      { role: "system", content: buildSystemPrompt(req) },
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "worksheet_analysis",
        schema: ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Featherless returned an empty response.");
  }
  return JSON.parse(text) as WorksheetAnalysis;
}
