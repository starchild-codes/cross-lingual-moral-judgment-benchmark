import HostedScenarioValidationPanel from "@/components/HostedScenarioValidationPanel";
import { authorizeTrial2Coder, getTrial2Scenarios } from "@/lib/scenario-validation-trial2-server";
import { isTrial2CoderId } from "@/lib/scenario-validation-trial2-shared";

export const dynamic = "force-dynamic";

export default function HostedValidationPage({
  params,
  searchParams
}: {
  params: { coderId: string };
  searchParams: { token?: string };
}) {
  if (!isTrial2CoderId(params.coderId)) {
    return <ErrorPage message="This coder link is not recognized." />;
  }

  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  if (!token) return <ErrorPage message="This link is incomplete. Please ask the study administrator for your full private link." />;
  if (!authorizeTrial2Coder(params.coderId, token)) return <ErrorPage message="This private coder link is invalid." />;

  return <HostedScenarioValidationPanel coderId={params.coderId} token={token} items={getTrial2Scenarios(params.coderId)} />;
}

function ErrorPage({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-2xl font-semibold">Scenario Foundation Validation</h1>
      <p className="mt-4 border border-rose-300 bg-rose-50 p-4 text-rose-900">{message}</p>
    </main>
  );
}
