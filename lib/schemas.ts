import { z } from "zod";
import { languageCodes } from "./languages";

export const modelKeys = ["chatgpt", "claude", "gemini_flash", "gemini_pro"] as const;
export const evaluatedModelKeys = ["chatgpt", "claude", "gemini_flash"] as const;
export type ModelKey = (typeof modelKeys)[number];
export type EvaluatedModelKey = (typeof evaluatedModelKeys)[number];

export const scenarioVersions = ["en", "translation", "adapted"] as const;
export type ScenarioVersion = (typeof scenarioVersions)[number];

export const taskTypes = ["rating", "qualitative"] as const;
export type TaskType = (typeof taskTypes)[number];

export const workUnitStatuses = ["pending", "running", "succeeded", "failed", "skipped"] as const;
export type WorkUnitStatus = (typeof workUnitStatuses)[number];

export const scenarioSchema = z.object({
  scenario_id: z.string().regex(/^S\d{2}$/),
  mft_category: z.enum(["Direct Harm", "Betrayal of Trust", "Defiance of Authority", "Fairness Violation", "Purity/Sanctity"]),
  mft_foundation: z.enum([
    "Care/Harm",
    "Loyalty/Fairness",
    "Authority/Loyalty",
    "Fairness/Care",
    "Sanctity",
    "Loyalty/Betrayal",
    "Authority/Subversion",
    "Fairness/Cheating",
    "Sanctity/Degradation"
  ]),
  moral_structure_en: z.string().min(1),
  text_en: z.string().min(1),
  text_hi_b: z.string().min(1),
  text_hi_c: z.string().min(1),
  text_bn_b: z.string().min(1),
  text_bn_c: z.string().min(1),
  text_ta_b: z.string().min(1),
  text_ta_c: z.string().min(1),
  text_es_b: z.string().min(1),
  text_es_c: z.string().min(1),
  text_ja_b: z.string().min(1),
  text_ja_c: z.string().min(1),
  text_ar_b: z.string(),
  text_ar_c: z.string()
});

export type Scenario = z.infer<typeof scenarioSchema>;

export const scenarioColumns = Object.keys(scenarioSchema.shape) as Array<keyof Scenario>;
export const sourceScenarioColumns = [
  "scenarios_id",
  "mft_category",
  "mft_foundation",
  "text_en",
  "text_hi_b",
  "text_hi_c",
  "text_bn_b",
  "text_bn_c",
  "text_ta_b",
  "text_ta_c",
  "text_es_b",
  "text_es_c",
  "text_ja_b",
  "text_ja_c",
  "text_ar_b",
  "text_ar_c"
] as const;

export const conditionSchema = z.object({
  id: z.string(),
  inputLang: z.enum(languageCodes),
  reasoningLang: z.enum(languageCodes),
  scenarioVersion: z.enum(scenarioVersions),
  label: z.string()
});

export type Condition = z.infer<typeof conditionSchema>;

export const workUnitSchema = z.object({
  id: z.string(),
  runId: z.string(),
  status: z.enum(workUnitStatuses),
  attemptCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  modelKey: z.enum(modelKeys),
  modelString: z.string(),
  scenarioId: z.string(),
  conditionId: z.string(),
  inputLang: z.enum(languageCodes),
  reasoningLang: z.enum(languageCodes),
  scenarioVersion: z.enum(scenarioVersions),
  taskType: z.enum(taskTypes),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() })),
  rawOutput: z.string().nullable(),
  rawResponse: z.unknown().nullable(),
  parsedRating: z.number().int().min(1).max(7).nullable(),
  errorNote: z.string().nullable()
});

export type WorkUnit = z.infer<typeof workUnitSchema>;

export type RunRecord = {
  id: string;
  mode: "pilot" | "full";
  status: "created" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  totalUnits: number;
};
