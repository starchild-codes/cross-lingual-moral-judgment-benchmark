import { runWilcoxonUnitTests } from "./wilcoxon.test";

const results = runWilcoxonUnitTests();
console.log(`${results.length} Wilcoxon signed-rank tests passed.`);
