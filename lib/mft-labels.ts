export const mftCodes = [
  "Care/Harm",
  "Loyalty/Betrayal",
  "Authority/Subversion",
  "Fairness/Cheating",
  "Sanctity/Degradation"
] as const;

export type MftCode = (typeof mftCodes)[number];
