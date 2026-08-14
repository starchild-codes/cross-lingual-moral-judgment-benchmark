export type RankedDifference = {
  value: number;
  abs: number;
  rank: number;
  scaledRank: number;
};

export type WilcoxonResult = {
  pValue: number;
  wPlus: number;
  wMinus: number;
  statistic: number;
  nonzeroN: number;
  positiveN: number;
  negativeN: number;
  zeroN: number;
  tiedAbsoluteRankGroups: number;
  method: string;
  exact: boolean;
  iterations: number | null;
  seed: number | null;
};

export function rankAbsoluteDifferences(values: number[]): RankedDifference[] {
  const ranked = values
    .filter((value) => value !== 0)
    .map((value) => ({ value, abs: Math.abs(value), rank: 0, scaledRank: 0 }))
    .sort((a, b) => a.abs - b.abs);
  for (let i = 0; i < ranked.length;) {
    let j = i + 1;
    while (j < ranked.length && ranked[j].abs === ranked[i].abs) j += 1;
    const averageRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) {
      ranked[k].rank = averageRank;
      ranked[k].scaledRank = Math.round(averageRank * 2);
    }
    i = j;
  }
  return ranked;
}

export function wilcoxonSignedRank(values: number[]): WilcoxonResult {
  if (values.some((value) => !Number.isFinite(value))) throw new Error("Wilcoxon input contains a non-finite value.");
  const ranked = rankAbsoluteDifferences(values);
  const nonzeroN = ranked.length;
  const zeroN = values.length - nonzeroN;
  const positiveN = ranked.filter((entry) => entry.value > 0).length;
  const negativeN = ranked.filter((entry) => entry.value < 0).length;
  const tiedAbsoluteRankGroups = countTieGroups(ranked.map((entry) => entry.abs));
  if (!nonzeroN) {
    return {
      pValue: 1,
      wPlus: 0,
      wMinus: 0,
      statistic: 0,
      nonzeroN,
      positiveN,
      negativeN,
      zeroN,
      tiedAbsoluteRankGroups,
      method: "all_zero_no_difference",
      exact: true,
      iterations: null,
      seed: null
    };
  }

  const observedScaledWPlus = ranked
    .filter((entry) => entry.value > 0)
    .reduce((sum, entry) => sum + entry.scaledRank, 0);
  const totalScaledRank = ranked.reduce((sum, entry) => sum + entry.scaledRank, 0);
  const pValue = exactTwoSidedSignPermutation(ranked.map((entry) => entry.scaledRank), observedScaledWPlus);
  const wPlus = observedScaledWPlus / 2;
  const wMinus = (totalScaledRank - observedScaledWPlus) / 2;
  return {
    pValue: Math.max(Number.MIN_VALUE, Math.min(1, pValue)),
    wPlus,
    wMinus,
    statistic: Math.min(wPlus, wMinus),
    nonzeroN,
    positiveN,
    negativeN,
    zeroN,
    tiedAbsoluteRankGroups,
    method: nonzeroN <= 20
      ? "exact_two_sided_sign_permutation_enumerated_by_dynamic_programming"
      : "exact_two_sided_sign_permutation_dynamic_programming",
    exact: true,
    iterations: null,
    seed: null
  };
}

export function exactTwoSidedSignPermutation(scaledRanks: number[], observedScaledWPlus: number): number {
  const total = scaledRanks.reduce((sum, rank) => sum + rank, 0);
  const probabilities = new Float64Array(total + 1);
  probabilities[0] = 1;
  let reachable = 0;
  for (const rank of scaledRanks) {
    for (let sum = reachable; sum >= 0; sum -= 1) {
      const probability = probabilities[sum];
      if (!probability) continue;
      probabilities[sum] = probability * 0.5;
      probabilities[sum + rank] += probability * 0.5;
    }
    reachable += rank;
  }
  const observedDistance = Math.abs(observedScaledWPlus - total / 2);
  let probability = 0;
  for (let sum = 0; sum <= total; sum += 1) {
    if (Math.abs(sum - total / 2) + 1e-12 >= observedDistance) probability += probabilities[sum];
  }
  return Math.min(1, probability);
}

function countTieGroups(values: number[]) {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.values()].filter((count) => count > 1).length;
}
