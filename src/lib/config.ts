import path from "path";
import { z } from "zod";

const providerSchema = z.enum(["openai", "ollama", "none"]);

/** Prefer OPENAI_API_KEY; fall back to API_KEY (e.g. .env.local). */
export function resolveOpenAiApiKey(): string | undefined {
  const fromOpenAi = process.env.OPENAI_API_KEY?.trim();
  if (fromOpenAi) return fromOpenAi;
  const generic = process.env.API_KEY?.trim();
  if (generic) return generic;
  return undefined;
}

const envSchema = z.object({
  REPOCHECK_STORE_PATH: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OLLAMA_BASE_URL: z.string().url().optional().default("http://127.0.0.1:11434"),
  REPOCHECK_MODEL_PROVIDER: providerSchema.optional(),
  REPOCHECK_LLM_MODEL: z.string().optional(),
  REPOCHECK_ANALYSIS_ROOT: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

export type AppConfig = Omit<
  z.infer<typeof envSchema>,
  | "REPOCHECK_MODEL_PROVIDER"
  | "REPOCHECK_LLM_MODEL"
  | "REPOCHECK_ANALYSIS_ROOT"
  | "REPOCHECK_STORE_PATH"
> & {
  REPOCHECK_STORE_PATH?: string;
  REPOCHECK_MODEL_PROVIDER: z.infer<typeof providerSchema>;
  REPOCHECK_LLM_MODEL: string;
  REPOCHECK_ANALYSIS_ROOT?: string;
  analysisRootAbs: string;
  maxScanFileBytes: number;
  maxRepoWalkFiles: number;
};

function resolveModelProvider(): z.infer<typeof providerSchema> {
  const raw =
    process.env.REPOCHECK_MODEL_PROVIDER ??
    process.env.FILESENTINEL_MODEL_PROVIDER;
  if (raw != null && String(raw).trim() !== "") {
    const p = providerSchema.safeParse(String(raw).trim());
    return p.success ? p.data : "none";
  }
  if (resolveOpenAiApiKey()) return "openai";
  return "none";
}

function resolveLlmModel(): string {
  return (
    process.env.REPOCHECK_LLM_MODEL ??
    process.env.FILESENTINEL_LLM_MODEL ??
    "gpt-4o-mini"
  );
}

function resolveAnalysisRootOverride(): string | undefined {
  return (
    process.env.REPOCHECK_ANALYSIS_ROOT ??
    process.env.FILESENTINEL_ANALYSIS_ROOT
  );
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  const e = parsed.success
    ? parsed.data
    : { OLLAMA_BASE_URL: "http://127.0.0.1:11434" as const };
  const modelProvider = resolveModelProvider();
  const llmModel = resolveLlmModel();
  const analysisOverride = resolveAnalysisRootOverride();
  const analysisRootAbs =
    analysisOverride ?? path.join(process.cwd(), ".repocheck-analysis");
  const openAiKey = resolveOpenAiApiKey();
  return {
    ...e,
    OPENAI_API_KEY: openAiKey,
    REPOCHECK_MODEL_PROVIDER: modelProvider,
    REPOCHECK_LLM_MODEL: llmModel,
    REPOCHECK_ANALYSIS_ROOT: analysisOverride,
    analysisRootAbs,
    maxScanFileBytes: 2 * 1024 * 1024,
    maxRepoWalkFiles: 50_000,
  };
}

let _cfg: AppConfig | null = null;
export function getConfig(): AppConfig {
  if (!_cfg) _cfg = loadConfig();
  return _cfg;
}
