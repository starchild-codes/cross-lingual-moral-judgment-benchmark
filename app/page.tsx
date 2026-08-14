import RunDashboard from "@/components/RunDashboard";
import { loadScenarios } from "@/lib/scenarios";
import { getRunsOverview } from "@/lib/runs";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [scenarios, runs] = await Promise.all([loadScenarios(), getRunsOverview()]);
  return <RunDashboard scenarios={scenarios} runs={runs} />;
}
