import { z } from "zod";

export const findingSeveritySchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

export const fileCategorySchema = z.enum([
  "documents",
  "images",
  "archives",
  "code",
  "scripts",
  "installers",
  "unknown",
]);

export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
export type FileCategory = z.infer<typeof fileCategorySchema>;

export type HeuristicFinding = {
  severity: FindingSeverity;
  category: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  filePath?: string;
  lineHint?: string;
};
