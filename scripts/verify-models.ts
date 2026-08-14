import { verifyPinnedModels } from "../lib/openrouter";

async function main() {
  const results = await verifyPinnedModels();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
