import { createRun, executeRunStep } from "../lib/runs";

async function main() {
  const run = await createRun("pilot");
  console.log(`Created pilot run ${run.id} with ${run.totalUnits} units.`);
  const step = await executeRunStep(run.id, Number(process.env.STEP_LIMIT ?? 5));
  console.log(JSON.stringify(step, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
