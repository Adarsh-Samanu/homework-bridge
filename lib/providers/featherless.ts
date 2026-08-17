import OpenAI from "openai";
import { buildSystemPrompt, buildUserPrompt, JSON_SHAPE_INSTRUCTION } from "../prompt";
import { extractJson, validateShape } from "../json";
import type { AnalyzeRequest, WorksheetAnalysis } from "../types";

/**
 * Featherless AI exposes an OpenAI-compatible endpoint, so the official
 * `openai` client works unchanged against their base URL.
 *
 * Two behaviors of theirs shape this file, both verified against the live API:
 *
 * 1. Strict `json_schema` response format is rejected on their VL models
 *    (Qwen3-VL 4B returns an explicit "request was rejected as invalid").
 *    `json_object` mode works, so the schema is carried in the prompt and the
 *    response is parsed defensively.
 *
 * 2. Individual models return "This model is busy, please try again later"
 *    unpredictably — the same model can serve a request and then be busy
 *    seconds later. A demo pinned to one model id will be down when a judge
 *    opens it, so we walk a fallback chain instead.
 */

const DEFAULT_MODEL_CHAIN = [
  "Qwen/Qwen3-VL-32B-Instruct",
  "Qwen/Qwen3-VL-8B-Instruct",
  "Qwen/Qwen2.5-VL-32B-Instruct",
  "Qwen/Qwen2.5-VL-7B-Instruct",
  "Qwen/Qwen3-VL-4B-Instruct",
];

function modelChain(): string[] {
  const configured = process.env.FEATHERLESS_VISION_MODEL;
  if (!configured) return DEFAULT_MODEL_CHAIN;
  // The preferred model leads; the rest of the chain still backs it up.
  const preferred = configured.split(",").map((m) => m.trim()).filter(Boolean);
  return [...preferred, ...DEFAULT_MODEL_CHAIN.filter((m) => !preferred.includes(m))];
}

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
    maxRetries: 0, // we manage retries across the model chain ourselves
  });
}

function isTransient(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("busy") ||
    m.includes("temporarily") ||
    m.includes("capacity") ||
    m.includes("overload") ||
    m.includes("timeout") ||
    m.includes("503")
  );
}

export async function analyzeWithFeatherless(
  req: AnalyzeRequest,
): Promise<WorksheetAnalysis> {
  const api = client();
  const chain = req.modelOverride ? [req.modelOverride] : modelChain();

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: "text", text: `${buildUserPrompt(req)}\n\n${JSON_SHAPE_INSTRUCTION}` },
  ];
  if (req.imageBase64) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${req.imageMediaType ?? "image/jpeg"};base64,${req.imageBase64}`,
      },
    });
  }

  const failures: string[] = [];

  for (const model of chain) {
    try {
      const completion = await api.chat.completions.create({
        model,
        max_tokens: 4000,
        messages: [
          { role: "system", content: buildSystemPrompt(req) },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) {
        failures.push(`${model}: empty response`);
        continue;
      }

      const parsed = extractJson(text);
      const missing = validateShape(parsed);
      if (missing.length > 0) {
        failures.push(`${model}: missing ${missing.join(", ")}`);
        continue;
      }

      return parsed as WorksheetAnalysis;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${model}: ${message}`);
      // A non-transient failure (bad request, auth) will repeat on every model,
      // so stop rather than burning the whole chain on the same error.
      if (!isTransient(message) && !message.includes("JSON")) {
        break;
      }
    }
  }

  throw new Error(
    `All Featherless models failed. Tried ${chain.length}: ${failures.join(" | ")}`,
  );
}
