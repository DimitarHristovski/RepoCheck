import type { HeuristicFinding } from "@/lib/types/findings";
import { z } from "zod";

/** Transparent weights — tune via config later. */
const WEIGHTS: Record<string, number> = {
  install_hooks: 18,
  obfuscation: 14,
  encoded_payload: 16,
  shell_execution: 20,
  network_exfil: 15,
  secret_harvest: 22,
  persistence: 20,
  workflow_risk: 12,
  hidden_binary: 10,
  type_mismatch: 6,
  duplicate_system_name: 5,
  startup_script: 14,
  archive_anomaly: 8,
  dependency_typosquat: 6,
  miner: 25,
  default: 8,
};

export const riskLabelSchema = z.enum([
  "low_risk",
  "suspicious",
  "high_risk",
  "strongly_unsafe",
]);

export type RiskLabel = z.infer<typeof riskLabelSchema>;

export type RiskScoreResult = {
  totalScore: number;
  confidence: number;
  label: RiskLabel;
  subscores: Record<string, number>;
  rationale: string[];
};

function severityMultiplier(s: HeuristicFinding["severity"]): number {
  switch (s) {
    case "critical":
      return 1.4;
    case "high":
      return 1.2;
    case "medium":
      return 1;
    case "low":
      return 0.6;
    case "info":
      return 0.3;
    default:
      return 1;
  }
}

export function scoreFindings(findings: HeuristicFinding[]): RiskScoreResult {
  const subscores: Record<string, number> = {};
  const rationale: string[] = [];

  for (const f of findings) {
    const w = WEIGHTS[f.category] ?? WEIGHTS.default;
    const add = w * severityMultiplier(f.severity);
    subscores[f.category] = (subscores[f.category] ?? 0) + add;
    rationale.push(
      `[${f.severity}] ${f.title}: ${f.description.slice(0, 200)}`
    );
  }

  let total = Object.values(subscores).reduce((a, b) => a + b, 0);
  total = Math.min(100, Math.round(total));

  const confidence = Math.min(
    100,
    40 + findings.filter((x) => x.severity !== "info").length * 8
  );

  let label: RiskLabel;
  if (total >= 85) label = "strongly_unsafe";
  else if (total >= 60) label = "high_risk";
  else if (total >= 35) label = "suspicious";
  else label = "low_risk";

  return { totalScore: total, confidence, label, subscores, rationale };
}
