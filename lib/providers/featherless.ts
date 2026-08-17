import OpenAI from "openai";
import { buildSystemPrompt, buildUserPrompt, JSON_SHAPE_INSTRUCTION } from "../prompt";
import { extractJson, validateShape } from "../json";
import type { AnalyzeRequest, WorksheetAnalysis } from "../types";

/**
 * Featherless AI, via the OpenAI-compatible endpoint.
 *
 * Three behaviors of the platform shape this file, all verified against the
 * live API rather than assumed:
 *
 * 1. Strict `json_schema` response format is rejected on their VL models
 *    (Qwen3-VL-4B returns an explicit "request was rejected as invalid").
 *    `json_object` works, so the schema travels in the prompt and the response
 *    is parsed defensively on the way back.
 *
 * 2. Any single model can return "This model is busy, please try again later"
 *    without warning — the same model serves a request and is busy seconds
 *    later. Pinning the demo to one id means it is down when a judge opens it,
 *    so every stage walks a fallback chain.
 *
 * 3. The strongest models are text-only. A mid-size vision model got the
 *    arithmetic wrong (claimed 62 - 27 = 55); GLM-5.2 got it right. Since a
 *    homework helper that confidently states wrong numbers is worse than no
 *    tool at all, reading and reasoning are split into two stages: a vision
 *    model only transcribes, and a frontier text model does all the thinking.
 *    Typed or pasted worksheets skip stage one entirely.
 */

/** Stage 1 — transcription only. Small models are fine at this. */
const VISION_CHAIN = [
  "Qwen/Qwen3-VL-32B-Instruct",
  "Qwen/Qwen3-VL-8B-Instruct",
  "Qwen/Qwen2.5-VL-32B-Instruct",
  "Qwen/Qwen2.5-VL-7B-Instruct",
  "Qwen/Qwen3-VL-4B-Instruct",
];

/** Stage 2 — the actual reasoning. Correctness lives or dies here. */
const REASONING_CHAIN = [
  "zai-org/GLM-5.2",
  "deepseek-ai/DeepSeek-V4-Pro",
  "moonshotai/Kimi-K2.5",
  "MiniMaxAI/MiniMax-M3",
  "Qwen/Qwen3-VL-235B-A22B-Thinking",
];

/**
 * Per-model deadline for the reasoning stage. Measured: GLM-5.2 answered in
 * 68s on one run and ran past 600s on another with the same worksheet, so the
 * spread is wide enough that an unbounded wait is not survivable for a demo.
 */
const REASONING_TIMEOUT_MS = Number(process.env.REASONING_TIMEOUT_MS ?? 150_000);

/**
 * Ceiling for the whole reasoning stage, across every model tried.
 *
 * The per-model deadline alone is not enough: five models at 150s each is 750s
 * worst case, which outlives the serverless function hosting it (maxDuration
 * 300). The request would be killed mid-chain and the caller would get a
 * platform timeout instead of the real error. This keeps the chain inside its
 * own budget so it always returns something explainable.
 */
const REASONING_BUDGET_MS = Number(process.env.REASONING_BUDGET_MS ?? 240_000);

/**
 * Output budget for the reasoning stage.
 *
 * Non-Latin scripts are markedly more expensive here: the Telugu worksheet
 * exhausted 8000 tokens inside the reasoning block and returned
 * finish_reason "length" with empty content, while the Spanish and Vietnamese
 * ones completed comfortably. Raising it fixes Telugu; the per-model deadline
 * is what keeps a model from thinking forever with the extra room.
 *
 * Overridable so cache generation can be generous offline while the deployed
 * app stays inside its serverless ceiling.
 */
const REASONING_MAX_TOKENS = Number(process.env.REASONING_MAX_TOKENS ?? 16_000);

const TRANSCRIBE_PROMPT = `Transcribe this worksheet exactly as printed. Preserve the
problem numbering, every number, and the instructions verbatim. Do not solve
anything, do not explain, do not translate. If part of the image is unreadable,
write [unreadable] in that spot rather than guessing at it.`;

function chainFor(configured: string | undefined, fallback: string[]): string[] {
  if (!configured) return fallback;
  const preferred = configured.split(",").map((m) => m.trim()).filter(Boolean);
  return [...preferred, ...fallback.filter((m) => !preferred.includes(m))];
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
    maxRetries: 0, // retries are handled across the model chain instead
  });
}

function isTransient(message: string): boolean {
  const m = message.toLowerCase();
  return ["busy", "temporarily", "capacity", "overload", "timeout", "503"].some((k) =>
    m.includes(k),
  );
}

/** Stage 1: photo -> plain text. Skipped when the parent typed the worksheet. */
async function transcribe(api: OpenAI, req: AnalyzeRequest): Promise<string> {
  const chain = chainFor(process.env.FEATHERLESS_VISION_MODEL, VISION_CHAIN);
  const failures: string[] = [];

  for (const model of chain) {
    try {
      const completion = await api.chat.completions.create({
        model,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: TRANSCRIBE_PROMPT },
              {
                type: "image_url",
                image_url: {
                  url: `data:${req.imageMediaType ?? "image/jpeg"};base64,${req.imageBase64}`,
                },
              },
            ],
          },
        ],
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) return text;
      failures.push(`${model}: empty`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${model}: ${message}`);
      if (!isTransient(message)) break;
    }
  }
  throw new Error(`Could not read the photo. Tried ${chain.length} models: ${failures.join(" | ")}`);
}

/** Stage 2: worksheet text -> the full analysis. */
async function reason(
  api: OpenAI,
  req: AnalyzeRequest,
  worksheet: string,
): Promise<WorksheetAnalysis> {
  const chain = req.modelOverride
    ? [req.modelOverride]
    : chainFor(process.env.FEATHERLESS_REASONING_MODEL, REASONING_CHAIN);
  const failures: string[] = [];
  const deadline = Date.now() + REASONING_BUDGET_MS;

  for (const model of chain) {
    const remaining = deadline - Date.now();
    // Below ~20s there is no point starting another large model: it will not
    // finish, and the caller is better served by the accumulated error.
    if (remaining < 20_000) {
      failures.push(`(stopped: ${Math.round(REASONING_BUDGET_MS / 1000)}s budget spent)`);
      break;
    }
    try {
      const completion = await api.chat.completions.create({
        model,
        max_tokens: REASONING_MAX_TOKENS,
        messages: [
          { role: "system", content: buildSystemPrompt(req) },
          {
            role: "user",
            content: `Here is the homework:\n\n${worksheet}\n\n${JSON_SHAPE_INSTRUCTION}`,
          },
        ],
        response_format: { type: "json_object" },
      }, {
        // A reasoning model with no deadline is a hung demo. GLM-5.2 ran past
        // 600s on a real worksheet without returning; abandoning it and moving
        // down the chain is strictly better than making a parent — or a
        // judge — wait on a model that may never answer.
        timeout: Math.min(REASONING_TIMEOUT_MS, remaining),
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) {
        failures.push(
          `${model}: empty content (finish_reason=${completion.choices[0]?.finish_reason})`,
        );
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
      if (!isTransient(message) && !message.includes("JSON")) break;
    }
  }

  throw new Error(`All reasoning models failed. Tried ${chain.length}: ${failures.join(" | ")}`);
}

export async function analyzeWithFeatherless(
  req: AnalyzeRequest,
): Promise<WorksheetAnalysis> {
  const api = client();
  const worksheet = req.text?.trim()
    ? req.text.trim()
    : await transcribe(api, req);
  return reason(api, req, worksheet);
}
