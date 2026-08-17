/**
 * Defensive JSON extraction.
 *
 * Featherless's VL models reject OpenAI's strict `json_schema` response format
 * (verified against Qwen3-VL 4B/8B/32B and Qwen2.5-VL 7B/32B — the 4B returns
 * an explicit "request was rejected as invalid"). `json_object` mode works, but
 * it only guarantees *some* JSON object, not our shape, and models still
 * occasionally wrap output in a markdown fence.
 *
 * So: ask for the shape in the prompt, then parse like we don't trust it.
 */

export function extractJson(raw: string): unknown {
  const text = raw.trim();

  // Fast path: already clean JSON.
  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }

  // Strip a ```json ... ``` fence if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }

  // Last resort: take the outermost balanced object. Bracket-counting rather
  // than a greedy regex, so prose on either side does not swallow the braces.
  const start = text.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("Model did not return parseable JSON.");
}

const REQUIRED_KEYS = [
  "subject",
  "gradeLevel",
  "assignment",
  "jargon",
  "schoolMethod",
  "familiarMethod",
  "bridge",
  "notationWarnings",
  "questionsToAsk",
] as const;

/**
 * Checks the shape we actually render. Without strict schema enforcement a
 * model can return valid JSON with the wrong keys, which would otherwise blow
 * up in the UI instead of here where we can retry.
 */
export function validateShape(value: unknown): string[] {
  const missing: string[] = [];
  if (typeof value !== "object" || value === null) {
    return ["response was not a JSON object"];
  }
  const obj = value as Record<string, unknown>;
  for (const key of REQUIRED_KEYS) {
    if (!(key in obj) || obj[key] === undefined) missing.push(key);
  }
  const method = obj.schoolMethod as Record<string, unknown> | undefined;
  if (method && !Array.isArray(method.steps)) missing.push("schoolMethod.steps");
  for (const arrayKey of ["jargon", "notationWarnings", "questionsToAsk"]) {
    if (arrayKey in obj && !Array.isArray(obj[arrayKey])) missing.push(arrayKey);
  }
  return missing;
}
