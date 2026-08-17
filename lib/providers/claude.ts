import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_SCHEMA } from "../schema";
import { buildSystemPrompt, buildUserPrompt } from "../prompt";
import type { AnalyzeRequest, WorksheetAnalysis } from "../types";

/**
 * Claude path. Selected with MODEL_PROVIDER=claude.
 *
 * effort is "medium" rather than the "high" default: this is bounded
 * extraction against a schema, not open-ended reasoning, and a parent standing
 * at a kitchen table with a phone notices latency more than they notice the
 * last few points of analytical depth. Raise it if the method comparisons come
 * back shallow.
 */
export async function analyzeWithClaude(
  req: AnalyzeRequest,
): Promise<WorksheetAnalysis> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and fill it in.",
    );
  }

  const client = new Anthropic();

  const content: Anthropic.ContentBlockParam[] = [];

  if (req.imageBase64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: (req.imageMediaType ??
          "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: req.imageBase64,
      },
    });
  }
  content.push({ type: "text", text: buildUserPrompt(req) });

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: buildSystemPrompt(req),
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [{ role: "user", content }],
  });

  // A safety decline arrives as a normal 200 with an empty content array, so
  // reading content[0] without this check throws a confusing TypeError instead
  // of the real reason.
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to process this worksheet.");
  }

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content.");
  }
  return JSON.parse(block.text) as WorksheetAnalysis;
}
