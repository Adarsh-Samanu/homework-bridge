/**
 * The shape a worksheet analysis returns.
 *
 * The core idea: translation alone does not let a parent help. The parent needs
 * the school's method mapped onto the method they themselves learned. Every
 * field below exists to serve that mapping.
 */

export interface WorkedStep {
  /** What this step does, in the parent's language. */
  explanation: string;
  /** The math itself — kept as notation, not translated. */
  notation: string;
}

export interface MethodExplanation {
  /** Human-readable name of the method, in the parent's language. */
  name: string;
  /** Where this method is taught ("your child's school" / "India, pre-2010"). */
  origin: string;
  steps: WorkedStep[];
}

export interface WorksheetAnalysis {
  /** Subject as detected from the worksheet image. */
  subject: string;
  /** US grade level, plus the local equivalent if one differs by name. */
  gradeLevel: string;
  /** What the assignment is actually asking for, in the parent's language. */
  assignment: string;
  /**
   * School jargon found on the sheet that has no dictionary translation
   * ("number bond", "exit ticket", "Lexile level"). Explained, not translated.
   */
  jargon: Array<{ term: string; meaning: string }>;
  /** The method the school expects, worked through on one real problem. */
  schoolMethod: MethodExplanation;
  /**
   * The SAME problem solved the way the parent learned it, plus how the two
   * line up. This is the part no existing tool does.
   */
  familiarMethod: MethodExplanation | null;
  /** How the two methods correspond, step by step. */
  bridge: string | null;
  /** Notation traps: decimal commas, different division symbols, etc. */
  notationWarnings: string[];
  /** Questions to ask the child instead of giving them the answer. */
  questionsToAsk: string[];
}

export interface AnalyzeRequest {
  /** Base64-encoded worksheet image, or plain text if the parent typed it. */
  imageBase64?: string;
  imageMediaType?: string;
  text?: string;
  /** BCP-47 code for the parent's language, e.g. "es", "te", "vi". */
  language: string;
  /** Country whose math methods the parent learned, e.g. "MX", "IN", "VN". */
  schoolingCountry: string;
  /**
   * Forces a specific model, bypassing the fallback chain. Exists so the eval
   * harness can A/B models through the real prompt path rather than a copy of
   * it that can drift. Not set by the UI.
   */
  modelOverride?: string;
}
