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
const PER_CALL_MAX_TOKENS = Number(process.env.FAST_MAX_TOKENS ?? 3_000);

/**
 * Stage 1 returns seven fields (jargon, warnings, three questions, the pinned
 * problem) where a method call returns three, and these models count their
 * reasoning against the same budget. At 3000 the brief truncated on the
 * fastest model and fell through to one taking ~14s, which was the single
 * largest remaining cost in the request.
 */
const BRIEF_MAX_TOKENS = Number(process.env.FAST_BRIEF_MAX_TOKENS ?? 6_000);

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
/** Per-stage timings, logged so slow stages can be found rather than guessed at. */
export interface StageTiming { label: string; model: string; ms: number }

async function call(
  api: OpenAI,
  system: string,
  user: string,
  label: string,
  timings?: StageTiming[],
  maxTokens: number = PER_CALL_MAX_TOKENS,
): Promise<Record<string, unknown>> {
  const failures: string[] = [];
  for (const model of fastChain()) {
    try {
      const started = Date.now();
      const completion = await api.chat.completions.create(
        {
          model,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        },
        { timeout: PER_CALL_TIMEOUT_MS },
      );
      const choice = completion.choices[0];
      /**
       * Some models here return the answer in `reasoning` and leave `content`
       * empty — GLM-4.7-Flash does this consistently in JSON mode, at every
       * token budget, while still reporting finish_reason "stop". The output
       * is valid JSON, just in the wrong field. Skipping it would discard a
       * model that answers in ~1s in favour of one taking 10-20s, so read
       * either field. Not in the SDK types, hence the cast.
       */
      const message = choice?.message as
        | (typeof choice.message & { reasoning?: string })
        | undefined;
      const text = message?.content?.trim() || message?.reasoning?.trim();
      if (!text) {
        failures.push(`${model}: empty (${choice?.finish_reason})`);
        continue;
      }
      const parsed = extractJson(text) as Record<string, unknown>;
      // Record only after the parse succeeds: an unparseable reply is a failed
      // attempt, and logging it as a success made stage timings misleading.
      timings?.push({ label, model, ms: Date.now() - started });
      return parsed;
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

/**
 * Fallback when stage 1 omits the demo problem.
 *
 * The model usually returns one, but not always, and without it the whole
 * request failed with a 500 — a single missing field taking down an otherwise
 * good response. So derive one instead: take the first arithmetic expression
 * on the worksheet and shift its operands, which keeps the shape while
 * guaranteeing different numbers, so the worked examples still cannot be
 * copied onto the sheet.
 */
export function deriveDemoProblem(worksheet: string): string {
  const match = worksheet
    .replace(/,/g, "")
    .match(/(\d{1,5})\s*([-+x×*÷\/])\s*(\d{1,5})/);
  if (!match) return "";
  const [, aRaw, opRaw, bRaw] = match;
  const a = Number(aRaw);
  const b = Number(bRaw);
  const op = opRaw === "*" ? "x" : opRaw === "/" ? "÷" : opRaw;

  // Shift both operands, keeping the result sensible for the operation.
  if (op === "-") {
    const newA = a + 7;
    const newB = Math.min(b + 3, newA - 1);
    return `${newA} - ${newB}`;
  }
  if (op === "÷") {
    const divisor = b === 0 ? 3 : b;
    // Keep it a clean-ish division of similar magnitude.
    return `${(Math.floor(a / divisor) + 4) * divisor + 1} ÷ ${divisor}`;
  }
  return `${a + 5} ${op} ${b === 0 ? 3 : b}`;
}

export async function analyzeFast(
  api: OpenAI,
  req: AnalyzeRequest,
  worksheet: string,
): Promise<WorksheetAnalysis> {
  // Stage 1 — short, and it decides the problem both panels will work.
  const timings: StageTiming[] = [];
  const brief = await call(
    api,
    briefPrompt(req),
    `Here is the homework:\n\n${worksheet}`,
    "reading the worksheet",
    timings,
    BRIEF_MAX_TOKENS,
  );

  const demoProblem =
    String(brief.demoProblem ?? "").trim() || deriveDemoProblem(worksheet);
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
      timings,
    ),
    call(
      api,
      familiarMethodPrompt(req, demoProblem),
      `Work this problem: ${demoProblem}`,
      "your method",
      timings,
    ).catch(() => null), // the comparison is the bonus; never fail the whole request for it
  ]);

  console.log(
    "[fast] " + timings.map((t) => `${t.label}=${(t.ms / 1000).toFixed(1)}s(${t.model.split("/").pop()})`).join(" "),
  );

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
