import { createRun, executeRunStep } from "../lib/runs";

async function main() {
  const runId = process.env.RUN_ID;
  if (runId) {
    console.log(
      JSON.stringify(
        await executeRunStep(runId, Number(process.env.STEP_LIMIT ?? 5), Number(process.env.RUN_CONCURRENCY ?? 1)),
        null,
        2
      )
    );
  } else {
    const run = await createRun("full");
    console.log(`Created full run ${run.id} with ${run.totalUnits} units. Set RUN_ID=${run.id} to resume steps.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
