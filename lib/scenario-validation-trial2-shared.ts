export const trial2CoderIds = ["Coder_A", "Coder_B", "Coder_C"] as const;

export type Trial2CoderId = (typeof trial2CoderIds)[number];

export const trial2Foundations = [
  "Care/Harm",
  "Fairness/Cheating",
  "Loyalty/Betrayal",
  "Authority/Subversion",
  "Sanctity/Degradation"
] as const;

export type Trial2Foundation = (typeof trial2Foundations)[number];

export type Trial2Scenario = {
  scenario_id: string;
  scenario_text_en: string;
};

export type Trial2Response = {
  coder_id: Trial2CoderId;
  scenario_id: string;
  shown_order: number;
  scenario_text_en: string;
  coder_scenario_label: Trial2Foundation;
  coder_notes: string;
  saved_at: string;
  submitted_at: string | null;
  is_submitted: boolean;
};

export function isTrial2CoderId(value: string): value is Trial2CoderId {
  return trial2CoderIds.includes(value as Trial2CoderId);
}

export function isTrial2Foundation(value: string): value is Trial2Foundation {
  return trial2Foundations.includes(value as Trial2Foundation);
}

export function orderedScenariosForCoder(items: Trial2Scenario[], coderId: Trial2CoderId) {
  return [...items]
    .map((item) => ({ item, key: hashString(`scenario-validation-trial2:${coderId}:${item.scenario_id}`) }))
    .sort((a, b) => a.key - b.key || a.item.scenario_id.localeCompare(b.item.scenario_id))
    .map(({ item }, index) => ({ ...item, shown_order: index + 1 }));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
