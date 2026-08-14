import { computeKappa, loadCodingDecisions } from "@/lib/mft-coding";

async function main() {
  const [, , coderAPath, coderBPath] = process.argv;
  if (!coderAPath || !coderBPath) {
    console.error("Usage: corepack pnpm kappa <coder-a.csv> <coder-b.csv>");
    process.exit(1);
  }

  const [coderA, coderB] = await Promise.all([loadCodingDecisions(coderAPath), loadCodingDecisions(coderBPath)]);
  const result = computeKappa(coderA, coderB);

  console.log(`Matched coded responses: ${result.matched}`);
  console.log(`Percentage agreement: ${result.percentAgreement.toFixed(2)}%`);
  console.log(`Cohen's kappa: ${result.kappa === null ? "undefined" : result.kappa.toFixed(4)}`);
  console.log("");
  console.log("Confusion matrix (rows = coder A, columns = coder B)");
  console.log(["Coder A \\ Coder B", ...result.labels].join("\t"));
  result.confusionMatrix.forEach((row, index) => {
    console.log([result.labels[index], ...row.map(String)].join("\t"));
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
