export type NumericSummary = {
  n: number;
  mean: number | null;
  sd: number | null;
  standardError: number | null;
  ci95: [number, number] | null;
};

export function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const avg = mean(values);
  if (avg === null) return null;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function summarize(values: number[]): NumericSummary {
  const avg = mean(values);
  const sd = standardDeviation(values);
  const se = sd === null ? null : sd / Math.sqrt(values.length);
  return {
    n: values.length,
    mean: avg,
    sd,
    standardError: se,
    ci95: avg === null || se === null ? null : [avg - 1.96 * se, avg + 1.96 * se]
  };
}

export function pairedDifferenceSummary(pairs: Array<{ a: number; b: number }>) {
  const diffs = pairs.map((pair) => pair.a - pair.b);
  const summary = summarize(diffs);
  const t = summary.mean === null || summary.standardError === null || summary.standardError === 0 ? null : summary.mean / summary.standardError;
  const effectSize = summary.mean === null || summary.sd === null || summary.sd === 0 ? null : summary.mean / summary.sd;
  return { ...summary, meanDifference: summary.mean, t, degreesFreedom: pairs.length > 1 ? pairs.length - 1 : null, effectSize };
}
