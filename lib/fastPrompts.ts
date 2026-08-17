import { findProfile } from "./methods";
import { languageName } from "./prompt";
import type { AnalyzeRequest } from "./types";

/**
 * Prompts for the fast path.
 *
 * The single-call prompt asks for eight things at once and measured 247-458s.
 * Generation is sequential, so wall-clock is dominated by output length, and a
 * warm model answering a trivial request returns in under a second — the time
 * is spent producing tokens, not starting up.
 *
 * So the work is split. One short call reads the worksheet and *pins the demo
 * problem*; two calls then work that same pinned problem concurrently. Pinning
 * matters: the whole product is two methods solving the same problem side by
 * side, and independent calls would each pick their own.
 *
 * Every prompt here caps step counts and explanation length. Those caps are
 * latency controls first and readability second.
 */

const BREVITY = `Be brief: at most 3 steps, each explanation one sentence of 25 words or fewer.

"notation" MUST contain the actual arithmetic with real digits — the numbers
being combined and the result, e.g. "8 - 6 = 2" or the written column layout.
Never put a bare restatement of the problem there, and never leave it vague.
Showing the working is the entire point; a step with no numbers in it is
useless to the parent.`;

function languageRule(lang: string): string {
  return `Write EVERY piece of prose in ${lang} — including method names, the
"origin" field, and the bridge. Do not write any of them in English. The parent
does not read English; an English sentence in the output is a failure, not a
fallback.

Keep mathematics as notation — digits and symbols stay in standard written
form, never spelled out as words in ${lang}.

A method's "name" is what the method is called (e.g. the ${lang} for "column
subtraction"), never a problem or an expression.`;
}

/** Stage 1: read the sheet, and choose the problem both methods will work. */
export function briefPrompt(req: AnalyzeRequest): string {
  const lang = languageName(req.language);
  return `You are helping a parent who does not read English understand their child's
homework. The parent can already do this math; what blocks them is the method
and notation.

${languageRule(lang)}

Read the worksheet and return JSON with exactly these keys:

{
  "subject": string,
  "gradeLevel": string,
  "assignment": string,
  "jargon": [{ "term": string, "meaning": string }],
  "notationWarnings": [string],
  "questionsToAsk": [string],
  "demoProblem": string
}

- assignment: one or two sentences on what the child must actually do.
- jargon: US school terms with no dictionary equivalent ("number bond", "exit
  ticket", "regrouping"). Skip ordinary words. At most 4.
- notationWarnings: number formats that could be misread by someone schooled
  outside the US — decimal commas, digit grouping. At most 2. Empty array if none.
- questionsToAsk: exactly 3 short questions, in ${lang}, that check the child's
  understanding without giving away an answer.
- demoProblem: a problem of the SAME SHAPE as the assigned ones but with
  DIFFERENT numbers, written as plain notation only, e.g. "47 - 28" or
  "36 x 7". This is what the worked examples will use, so the parent cannot
  copy them onto the sheet. Return the bare expression, nothing else.

${BREVITY}`;
}

/** Stage 2a: the school's method, on the pinned problem. */
export function schoolMethodPrompt(req: AnalyzeRequest, demoProblem: string): string {
  const lang = languageName(req.language);
  return `A parent needs to understand the method their child's US school expects.

${languageRule(lang)}

Work this exact problem using the method the worksheet requires: ${demoProblem}

Return JSON:

{
  "name": string,
  "origin": string,
  "steps": [{ "explanation": string, "notation": string }]
}

- name: the method's name, in ${lang}.
- origin: one short clause on where it is taught, e.g. "taught in US schools".
- steps: the worked solution to ${demoProblem}. Show the actual arithmetic.

${BREVITY}`;
}

/** Stage 2b: the parent's own method on the same problem, plus the bridge. */
export function familiarMethodPrompt(req: AnalyzeRequest, demoProblem: string): string {
  const lang = languageName(req.language);
  const profile = findProfile(req.schoolingCountry);

  const grounding = profile
    ? `The parent went to school in ${profile.name}. How arithmetic is taught there:

${Object.entries(profile.methods).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Notation differences: ${profile.notation.join(" ")}

Use whichever of these applies to this problem. If none covers it, reason from
what you know about that country's curriculum and say so plainly in "origin"
rather than inventing a method name.`
    : `The parent's schooling country is unknown. Return "name" as a short note
saying a comparison needs their country, an empty steps array, and a "bridge"
saying the same.`;

  return `A parent is looking at their child's US worksheet. Show them the SAME problem
solved the way THEY were taught, so they can recognize their own arithmetic
inside their child's homework.

${languageRule(lang)}

${grounding}

Work this exact problem the way the parent learned it: ${demoProblem}

Return JSON:

{
  "name": string,
  "origin": string,
  "steps": [{ "explanation": string, "notation": string }],
  "bridge": string
}

- This must be the parent's ACTUAL different procedure — including where digits
  are physically written when that differs — not the US method reworded.
- bridge: two sentences. Which step matches which, and the one real difference.

${BREVITY}`;
}
