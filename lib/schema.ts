/**
 * One JSON Schema, used by both providers.
 *
 * Featherless (OpenAI-compatible) takes it as `response_format.json_schema`;
 * Claude takes it as `output_config.format`. Keeping a single definition is
 * what makes the two adapters interchangeable — if the schema drifts between
 * them, switching providers silently changes the shape of the UI's data.
 */

const workedStep = {
  type: "object",
  properties: {
    explanation: { type: "string" },
    notation: { type: "string" },
  },
  required: ["explanation", "notation"],
  additionalProperties: false,
} as const;

const methodExplanation = {
  type: "object",
  properties: {
    name: { type: "string" },
    origin: { type: "string" },
    steps: { type: "array", items: workedStep },
  },
  required: ["name", "origin", "steps"],
  additionalProperties: false,
} as const;

export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    gradeLevel: { type: "string" },
    assignment: { type: "string" },
    jargon: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          meaning: { type: "string" },
        },
        required: ["term", "meaning"],
        additionalProperties: false,
      },
    },
    schoolMethod: methodExplanation,
    familiarMethod: methodExplanation,
    bridge: { type: "string" },
    notationWarnings: { type: "array", items: { type: "string" } },
    questionsToAsk: { type: "array", items: { type: "string" } },
  },
  required: [
    "subject",
    "gradeLevel",
    "assignment",
    "jargon",
    "schoolMethod",
    "familiarMethod",
    "bridge",
    "notationWarnings",
    "questionsToAsk",
  ],
  additionalProperties: false,
} as const;
