import type { AnalyzeRequest, WorksheetAnalysis } from "../types";
import { analyzeWithFeatherless } from "./featherless";
import { analyzeWithClaude } from "./claude";

export interface Provider {
  name: string;
  analyze(req: AnalyzeRequest): Promise<WorksheetAnalysis>;
}

/**
 * Provider is chosen by env var so switching is a redeploy, not a rewrite.
 *
 * Reading a photographed worksheet is the riskiest part of this app — if a
 * model's vision is weak on a parent's phone photo, nothing downstream matters.
 * Keeping both paths live means that failure is a config change.
 */
export function getProvider(): Provider {
  const choice = (process.env.MODEL_PROVIDER ?? "featherless").toLowerCase();

  switch (choice) {
    case "claude":
      return { name: "claude", analyze: analyzeWithClaude };
    case "featherless":
      return { name: "featherless", analyze: analyzeWithFeatherless };
    default:
      throw new Error(
        `Unknown MODEL_PROVIDER "${choice}". Use "featherless" or "claude".`,
      );
  }
}
