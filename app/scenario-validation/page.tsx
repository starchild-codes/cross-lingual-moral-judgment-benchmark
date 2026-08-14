import ScenarioValidationPanel from "@/components/ScenarioValidationPanel";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

type ScenarioValidationItem = {
  scenario_id: string;
  scenario_text_en: string;
};

export default async function ScenarioValidationPage() {
  const data = await loadScenarioValidationData();
  return <ScenarioValidationPanel fullItems={data.fullItems} authorityItems={data.authorityItems} dataAvailable={data.dataAvailable} />;
}

async function loadScenarioValidationData(): Promise<{
  fullItems: ScenarioValidationItem[];
  authorityItems: ScenarioValidationItem[];
  dataAvailable: boolean;
}> {
  const dir = path.join(process.cwd(), "results", "processed", "scenario_validation_interface");
  try {
    const [full, authority] = await Promise.all([
      readFile(path.join(dir, "scenario_validation_items.full.json"), "utf8"),
      readFile(path.join(dir, "scenario_validation_items.authority_only.json"), "utf8")
    ]);
    return {
      fullItems: JSON.parse(full) as ScenarioValidationItem[],
      authorityItems: JSON.parse(authority) as ScenarioValidationItem[],
      dataAvailable: true
    };
  } catch {
    return { fullItems: [], authorityItems: [], dataAvailable: false };
  }
}
