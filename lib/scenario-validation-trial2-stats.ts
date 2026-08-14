import {
  trial2CoderIds,
  trial2Foundations,
  type Trial2CoderId,
  type Trial2Foundation,
  type Trial2Response
} from "./scenario-validation-trial2-shared";

export type Trial2AdminKeyRow = {
  scenario_id: string;
  scenario_text_en: string;
  intended_mft_foundation: Trial2Foundation;
};

export type Trial2MergedRow = Trial2AdminKeyRow & {
  Coder_A_label: Trial2Foundation;
  Coder_A_notes: string;
  Coder_A_shown_order: number;
  Coder_B_label: Trial2Foundation;
  Coder_B_notes: string;
  Coder_B_shown_order: number;
  Coder_C_label: Trial2Foundation;
  Coder_C_notes: string;
  Coder_C_shown_order: number;
  majority_vote_label: Trial2Foundation | "";
  majority_matches_intended: boolean;
  num_coders_matching_intended: number;
  all_three_disagree: boolean;
};

export type PairwiseResult = {
  pair: string;
  raw_agreement: number;
  cohens_kappa: number;
};

export function mergeTrial2Responses(responses: Trial2Response[], adminRows: Trial2AdminKeyRow[]) {
  const byCoder = new Map<Trial2CoderId, Map<string, Trial2Response>>();
  for (const coderId of trial2CoderIds) {
    const rows = responses.filter((row) => row.coder_id === coderId);
    if (rows.length !== 50) throw new Error(`${coderId} has ${rows.length} rows; expected 50.`);
    const unique = new Map(rows.map((row) => [row.scenario_id, row]));
    if (unique.size !== 50) throw new Error(`${coderId} does not have 50 unique scenario IDs.`);
    if (rows.some((row) => !trial2Foundations.includes(row.coder_scenario_label))) {
      throw new Error(`${coderId} contains a missing or invalid foundation label.`);
    }
    byCoder.set(coderId, unique);
  }

  if (adminRows.length !== 50 || new Set(adminRows.map((row) => row.scenario_id)).size !== 50) {
    throw new Error("Admin key must contain exactly 50 unique scenario IDs.");
  }

  const adminIds = new Set(adminRows.map((row) => row.scenario_id));
  for (const coderId of trial2CoderIds) {
    const coderIds = new Set(byCoder.get(coderId)?.keys());
    if (coderIds.size !== adminIds.size || [...adminIds].some((id) => !coderIds.has(id))) {
      throw new Error(`${coderId} did not code the same 50 scenario IDs as the admin key.`);
    }
  }

  return adminRows.map((admin): Trial2MergedRow => {
    const a = required(byCoder.get("Coder_A")?.get(admin.scenario_id), `Coder_A ${admin.scenario_id}`);
    const b = required(byCoder.get("Coder_B")?.get(admin.scenario_id), `Coder_B ${admin.scenario_id}`);
    const c = required(byCoder.get("Coder_C")?.get(admin.scenario_id), `Coder_C ${admin.scenario_id}`);
    const labels = [a.coder_scenario_label, b.coder_scenario_label, c.coder_scenario_label];
    const majority = majorityVote(labels);
    return {
      ...admin,
      Coder_A_label: a.coder_scenario_label,
      Coder_A_notes: a.coder_notes,
      Coder_A_shown_order: a.shown_order,
      Coder_B_label: b.coder_scenario_label,
      Coder_B_notes: b.coder_notes,
      Coder_B_shown_order: b.shown_order,
      Coder_C_label: c.coder_scenario_label,
      Coder_C_notes: c.coder_notes,
      Coder_C_shown_order: c.shown_order,
      majority_vote_label: majority,
      majority_matches_intended: majority === admin.intended_mft_foundation,
      num_coders_matching_intended: labels.filter((label) => label === admin.intended_mft_foundation).length,
      all_three_disagree: new Set(labels).size === 3
    };
  });
}

export function computeTrial2Statistics(rows: Trial2MergedRow[]) {
  const pairwise = [
    pairwiseResult(rows, "Coder_A", "Coder_B"),
    pairwiseResult(rows, "Coder_A", "Coder_C"),
    pairwiseResult(rows, "Coder_B", "Coder_C")
  ];
  const coderIntended = Object.fromEntries(trial2CoderIds.map((coderId) => [
    coderId,
    proportion(rows, (row) => labelFor(row, coderId) === row.intended_mft_foundation)
  ])) as Record<Trial2CoderId, number>;
  const byFoundation = trial2Foundations.map((foundation) => {
    const subset = rows.filter((row) => row.intended_mft_foundation === foundation);
    return {
      intended_mft_foundation: foundation,
      n: subset.length,
      Coder_A_agreement_with_intended: proportion(subset, (row) => row.Coder_A_label === foundation),
      Coder_B_agreement_with_intended: proportion(subset, (row) => row.Coder_B_label === foundation),
      Coder_C_agreement_with_intended: proportion(subset, (row) => row.Coder_C_label === foundation),
      majority_vote_agreement_with_intended: proportion(subset, (row) => row.majority_matches_intended),
      at_least_one_coder_matches_intended: proportion(subset, (row) => row.num_coders_matching_intended >= 1),
      all_three_match_intended: proportion(subset, (row) => row.num_coders_matching_intended === 3),
      mean_pairwise_raw_agreement_within_foundation: mean([
        rawAgreement(subset.map((row) => [row.Coder_A_label, row.Coder_B_label])),
        rawAgreement(subset.map((row) => [row.Coder_A_label, row.Coder_C_label])),
        rawAgreement(subset.map((row) => [row.Coder_B_label, row.Coder_C_label]))
      ])
    };
  });

  return {
    pairwise,
    mean_pairwise_raw_agreement: mean(pairwise.map((row) => row.raw_agreement)),
    mean_pairwise_cohens_kappa: mean(pairwise.map((row) => row.cohens_kappa)),
    fleiss_kappa: fleissKappa(rows),
    coder_intended_agreement: coderIntended,
    majority_vote_agreement_with_intended: proportion(rows, (row) => row.majority_matches_intended),
    majority_mismatch_count: rows.filter((row) => !row.majority_matches_intended).length,
    all_three_disagree_count: rows.filter((row) => row.all_three_disagree).length,
    by_foundation: byFoundation
  };
}

function pairwiseResult(rows: Trial2MergedRow[], a: Trial2CoderId, b: Trial2CoderId): PairwiseResult {
  const pairs = rows.map((row) => [labelFor(row, a), labelFor(row, b)] as [Trial2Foundation, Trial2Foundation]);
  return { pair: `${a}_vs_${b}`, raw_agreement: rawAgreement(pairs), cohens_kappa: cohenKappa(pairs) };
}

function labelFor(row: Trial2MergedRow, coderId: Trial2CoderId) {
  return row[`${coderId}_label` as "Coder_A_label"] as Trial2Foundation;
}

function majorityVote(labels: Trial2Foundation[]): Trial2Foundation | "" {
  for (const label of trial2Foundations) if (labels.filter((value) => value === label).length >= 2) return label;
  return "";
}

function rawAgreement(pairs: Array<[Trial2Foundation, Trial2Foundation]>) {
  return pairs.length ? pairs.filter(([a, b]) => a === b).length / pairs.length : 0;
}

function cohenKappa(pairs: Array<[Trial2Foundation, Trial2Foundation]>) {
  if (!pairs.length) return 0;
  const observed = rawAgreement(pairs);
  const expected = trial2Foundations.reduce((sum, label) => {
    const a = pairs.filter(([value]) => value === label).length / pairs.length;
    const b = pairs.filter(([, value]) => value === label).length / pairs.length;
    return sum + a * b;
  }, 0);
  return expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected);
}

function fleissKappa(rows: Trial2MergedRow[]) {
  if (!rows.length) return 0;
  const ratingsPerItem = 3;
  const itemAgreement = rows.map((row) => {
    const labels = [row.Coder_A_label, row.Coder_B_label, row.Coder_C_label];
    const squaredCounts = trial2Foundations.reduce((sum, label) => {
      const count = labels.filter((value) => value === label).length;
      return sum + count * count;
    }, 0);
    return (squaredCounts - ratingsPerItem) / (ratingsPerItem * (ratingsPerItem - 1));
  });
  const observed = mean(itemAgreement);
  const expected = trial2Foundations.reduce((sum, label) => {
    const count = rows.reduce((total, row) => total + [row.Coder_A_label, row.Coder_B_label, row.Coder_C_label].filter((value) => value === label).length, 0);
    const share = count / (rows.length * ratingsPerItem);
    return sum + share * share;
  }, 0);
  return expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected);
}

function proportion<T>(rows: T[], predicate: (row: T) => boolean) {
  return rows.length ? rows.filter(predicate).length / rows.length : 0;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function required<T>(value: T | undefined, label: string): T {
  if (!value) throw new Error(`Missing ${label}.`);
  return value;
}
