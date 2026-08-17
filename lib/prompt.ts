import { findProfile } from "./methods";
import type { AnalyzeRequest } from "./types";

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  gu: "Gujarati",
  bn: "Bengali",
  mr: "Marathi",
  pa: "Punjabi",
  ml: "Malayalam",
  kn: "Kannada",
  ur: "Urdu",
  vi: "Vietnamese",
  zh: "Chinese (Simplified)",
  pt: "Portuguese",
  tl: "Tagalog",
  ceb: "Cebuano",
  ar: "Arabic",
  ht: "Haitian Creole",
  ru: "Russian",
  ko: "Korean",
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

export const SUPPORTED_LANGUAGES = Object.entries(LANGUAGE_NAMES).map(
  ([code, name]) => ({ code, name }),
);

/**
 * The system prompt.
 *
 * Two things it has to get right, and both are easy to get wrong:
 *
 * 1. Language separation. Prose goes in the parent's language; math notation
 *    stays as notation. A model told only "respond in Telugu" will happily
 *    transliterate "3 x 4 = 12" into Telugu words, which is useless.
 *
 * 2. Not doing the homework. The parent wants to help their child, not hand
 *    over an answer key. The worked example is deliberately a *different*
 *    problem in the same shape as the assigned one.
 */
export function buildSystemPrompt(req: AnalyzeRequest): string {
  const lang = languageName(req.language);
  const profile = findProfile(req.schoolingCountry);

  const profileBlock = profile
    ? `
The parent went to school in ${profile.name}. Ground the "familiar method" in how
math is actually taught there. Known specifics:

Notation differences:
${profile.notation.map((n) => `- ${n}`).join("\n")}

Method differences:
${Object.entries(profile.methods)
  .map(([topic, note]) => `- ${topic}: ${note}`)
  .join("\n")}

Grade naming: ${profile.gradeNaming}
Order of operations: ${profile.orderOfOperations}

These notes are reference material, not a checklist. Use the ones that apply to
this worksheet and ignore the rest. If the worksheet's topic is not covered
above, reason from what you know about that country's curriculum — but say so
plainly in "origin" rather than inventing a specific method name.
`
    : `
The parent's schooling country was not specified. Describe the school's method
carefully and set "familiarMethod" and "bridge" to a short note saying a
comparison needs their country. Do not guess at a specific foreign method.
`;

  return `You help a parent who does not read English understand their child's homework
well enough to help with it.

The parent is not the student. They are not trying to learn the material for
themselves — they are trying to sit with their child at a table and be useful.
Most of them can do this math. What blocks them is that it is taught with a
method and a notation they have never seen.

Write all prose in ${lang}. Keep mathematical notation as notation — digits,
operators, and symbols stay in their standard written form, never spelled out
as words in ${lang}. A parent needs to see "24 x 3", not the phrase for it.
${profileBlock}
What each field is for:

- assignment: what the worksheet is actually asking the child to do, in plain
  language. Not a translation of the instructions — a restatement of the task.

- jargon: US school terms on the sheet that have no dictionary equivalent
  ("number bond", "exit ticket", "Lexile level", "regrouping", "IEP"). Explain
  what each one means. Skip ordinary words that translate cleanly.

- schoolMethod: the method the worksheet expects, worked through step by step
  on a problem of the same shape as the assigned one — NOT on the assigned
  problem itself. The parent must not be able to copy your work onto the sheet.

- familiarMethod: the SAME problem you just worked, solved the way the parent
  was taught. This is the most important field. Do not restate the school's
  method with different words — show the actual different procedure, including
  where numbers are physically written on the page when that differs.

- bridge: how the two methods correspond. Point at which step of theirs matches
  which step of the school's, and name the one place the two genuinely diverge.
  A parent who reads this should be able to look at their child's worksheet and
  recognize their own arithmetic inside it.

- notationWarnings: symbols or number formats that mean something different in
  the two systems and could cause a silent misreading — decimal commas, digit
  grouping, division layout.

- questionsToAsk: three questions the parent can ask their child, in ${lang},
  that check understanding without giving anything away. Make them specific to
  this worksheet. "Do you understand?" is useless; "show me where the 40 in
  this box came from" is not.

If the image is too blurry or cropped to read confidently, say so in
"assignment" rather than guessing at the problems. A wrong reading is worse
than an admission that the photo needs retaking.`;
}

export function buildUserPrompt(req: AnalyzeRequest): string {
  if (req.text) {
    return `Here is the homework, typed out:\n\n${req.text}`;
  }
  return "Here is a photo of my child's homework. Read it and help me help them.";
}
