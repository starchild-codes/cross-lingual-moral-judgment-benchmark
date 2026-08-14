import "server-only";

import { timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import trial2ItemsJson from "@/data/scenario_validation_trial2/scenario_validation_items.json";
import {
  isTrial2CoderId,
  orderedScenariosForCoder,
  trial2CoderIds,
  type Trial2CoderId,
  type Trial2Response,
  type Trial2Scenario
} from "./scenario-validation-trial2-shared";

const trial2Items = trial2ItemsJson as Trial2Scenario[];

let cachedClient: SupabaseClient | null = null;

export function trial2IsConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getTrial2Scenarios(coderId: Trial2CoderId) {
  return orderedScenariosForCoder(trial2Items, coderId);
}

export function getTrial2ScenarioCount() {
  return trial2Items.length;
}

export function authorizeTrial2Coder(coderId: string, token: string | null) {
  if (!isTrial2CoderId(coderId) || !token) return false;
  const expected = process.env[tokenVariableForCoder(coderId)];
  return Boolean(expected && safeEqual(token, expected));
}

export function authorizeTrial2Admin(token: string | null) {
  const expected = process.env.SCENARIO_VALIDATION_ADMIN_TOKEN;
  return Boolean(token && expected && safeEqual(token, expected));
}

export async function getTrial2Responses(coderId: Trial2CoderId) {
  const { data, error } = await supabase()
    .from("scenario_validation_responses")
    .select("coder_id,scenario_id,shown_order,scenario_text_en,coder_scenario_label,coder_notes,saved_at,submitted_at,is_submitted")
    .eq("coder_id", coderId)
    .order("shown_order");
  if (error) throw new Error(`Could not load ${coderId} responses: ${error.message}`);
  return (data ?? []) as Trial2Response[];
}

export async function saveTrial2Response(response: Trial2Response) {
  const existing = await getTrial2Responses(response.coder_id);
  if (existing.some((row) => row.is_submitted)) throw new Error("Final responses have already been submitted and are locked.");

  const { data, error } = await supabase()
    .from("scenario_validation_responses")
    .upsert(response, { onConflict: "coder_id,scenario_id" })
    .select("coder_id,scenario_id,shown_order,scenario_text_en,coder_scenario_label,coder_notes,saved_at,submitted_at,is_submitted")
    .single();
  if (error) throw new Error(`Could not save response: ${error.message}`);
  return data as Trial2Response;
}

export async function submitTrial2Coder(coderId: Trial2CoderId) {
  const responses = await getTrial2Responses(coderId);
  const expectedIds = new Set(getTrial2Scenarios(coderId).map((item) => item.scenario_id));
  const complete = responses.length === expectedIds.size
    && new Set(responses.map((row) => row.scenario_id)).size === expectedIds.size
    && responses.every((row) => expectedIds.has(row.scenario_id) && row.coder_scenario_label);
  if (!complete) throw new Error(`Final submission requires all ${expectedIds.size} scenarios to be labeled.`);

  const submittedAt = new Date().toISOString();
  const { error } = await supabase()
    .from("scenario_validation_responses")
    .update({ is_submitted: true, submitted_at: submittedAt })
    .eq("coder_id", coderId);
  if (error) throw new Error(`Could not submit final responses: ${error.message}`);
  return { submittedAt, count: responses.length };
}

export async function getAllTrial2Responses() {
  const rows: Trial2Response[] = [];
  for (const coderId of trial2CoderIds) {
    rows.push(...await getTrial2Responses(coderId));
  }
  return rows;
}

function supabase() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase is not configured on the server.");
  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { "X-Client-Info": "scenario-validation-trial2" },
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" })
    }
  });
  return cachedClient;
}

function tokenVariableForCoder(coderId: Trial2CoderId) {
  return `SCENARIO_VALIDATION_${coderId.toUpperCase()}_TOKEN`;
}

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
