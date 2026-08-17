import OpenAI from "openai";
import { briefPrompt, schoolMethodPrompt, familiarMethodPrompt } from "../fastPrompts";
import { extractJson } from "../json";
import type { AnalyzeRequest, WorksheetAnalysis, MethodExplanation } from "../types";

/**
 * Fast path: three calls instead of one, two of them concurrent.
 *
 * Measured basis for this design:
 *  - A warm model answers a trivial request in 0.7-4.6s, so start-up is not
 *    the cost. Wall-clock is dominated by generating tokens sequentially.
 *  - The single-call pipeline asks for eight things at once and measured
 *    247s (Spanish), 272s (Vietnamese), 458s (Telugu).
 *
 * So: one short call reads the sheet and pins a demo problem, then the two
 * method explanations run in parallel against that pinned problem. Total time
 * is stage 1 plus the slower of the two, not the sum of everything.
 *
 * Pinning the problem in stage 1 is what makes the parallelism safe — both
 * panels must solve the same problem for the side-by-side to mean anything,
 * and independent calls would each choose their own.
 */

const FAST_MODEL_CHAIN = [
  "zai-org/GLM-4.7-Flash",
  "deepseek-ai/DeepSeek-V3.2",
  "zai-org/GLM-4.7",
  "Qwen/Qwen3-VL-32B-Instruct",
];

const PER_CALL_TIMEOUT_MS = Number(process.env.FAST_TIMEOUT_MS ?? 45_000);
const PER_CALL_MAX_TOKENS = Number(process.env.FAST_MAX_TOKENS ?? 2_000);

function fastChain(): string[] {
  const configured = process.env.FEATHERLESS_FAST_MODEL;
  if (!configured) return FAST_MODEL_CHAIN;
  const preferred = configured.split(",").map((m) => m.trim()).filter(Boolean);
  return [...preferred, ...FAST_MODEL_CHAIN.filter((m) => !preferred.includes(m))];
}

function isTransient(message: string): boolean {
  const m = message.toLowerCase();
  return ["busy", "temporarily", "capacity", "overload", "timeout", "503"].some((k) =>
    m.includes(k),
  );
}

/** One JSON call, walking the chain until a model returns parseable output. */
async function call(
  api: OpenAI,
  system: string,
  user: string,
  label: string,
): Promise<Record<string, unknown>> {
  const failures: string[] = [];
  for (const model of fastChain()) {
    try {
      const completion = await api.chat.completions.create(
        {
          model,
          max_tokens: PER_CALL_MAX_TOKENS,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        },
        { timeout: PER_CALL_TIMEOUT_MS },
      );
      const text = completion.choices[0]?.message?.content;
      if (!text) {
        failures.push(`${model}: empty (${completion.choices[0]?.finish_reason})`);
        continue;
      }
      return extractJson(text) as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${model}: ${message}`);
      if (!isTransient(message) && !message.includes("JSON")) break;
    }
  }
  throw new Error(`${label} failed: ${failures.join(" | ")}`);
}

function asMethod(raw: Record<string, unknown> | null): MethodExplanation | null {
  if (!raw) return null;
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  return {
    name: String(raw.name ?? ""),
    origin: String(raw.origin ?? ""),
    steps: steps.map((s) => {
      const step = s as Record<string, unknown>;
      return {
        explanation: String(step.explanation ?? ""),
        notation: String(step.notation ?? ""),
      };
    }),
  };
}

export async function analyzeFast(
  api: OpenAI,
  req: AnalyzeRequest,
  worksheet: string,
): Promise<WorksheetAnalysis> {
  // Stage 1 — short, and it decides the problem both panels will work.
  const brief = await call(
    api,
    briefPrompt(req),
    `Here is the homework:\n\n${worksheet}`,
    "reading the worksheet",
  );

  const demoProblem = String(brief.demoProblem ?? "").trim();
  if (!demoProblem) {
    throw new Error("Could not identify a problem to work through on this worksheet.");
  }

  // Stage 2 — both methods at once. Total is the slower of the two, not the sum.
  const [school, familiar] = await Promise.all([
    call(
      api,
      schoolMethodPrompt(req, demoProblem),
      `Work this problem: ${demoProblem}`,
      "the school's method",
    ),
    call(
      api,
      familiarMethodPrompt(req, demoProblem),
      `Work this problem: ${demoProblem}`,
      "your method",
    ).catch(() => null), // the comparison is the bonus; never fail the whole request for it
  ]);

  const jargon = Array.isArray(brief.jargon) ? brief.jargon : [];

  return {
    subject: String(brief.subject ?? ""),
    gradeLevel: String(brief.gradeLevel ?? ""),
    assignment: String(brief.assignment ?? ""),
    jargon: jargon.map((j) => {
      const item = j as Record<string, unknown>;
      return { term: String(item.term ?? ""), meaning: String(item.meaning ?? "") };
    }),
    schoolMethod: asMethod(school) ?? { name: "", origin: "", steps: [] },
    familiarMethod: asMethod(familiar),
    bridge: familiar ? String(familiar.bridge ?? "") : null,
    notationWarnings: Array.isArray(brief.notationWarnings)
      ? brief.notationWarnings.map(String)
      : [],
    questionsToAsk: Array.isArray(brief.questionsToAsk)
      ? brief.questionsToAsk.map(String)
      : [],
  };
}
