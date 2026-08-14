import Trial2AdminDashboard from "@/components/Trial2AdminDashboard";
import { authorizeTrial2Admin } from "@/lib/scenario-validation-trial2-server";
import { trial2CoderIds } from "@/lib/scenario-validation-trial2-shared";

export const dynamic = "force-dynamic";

export default function ValidationAdminPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  if (!authorizeTrial2Admin(token)) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-2xl font-semibold">Trial 2 Validation Admin</h1>
        <p className="mt-4 border border-rose-300 bg-rose-50 p-4 text-rose-900">This admin link is missing or invalid.</p>
      </main>
    );
  }

  const coderTokens = Object.fromEntries(trial2CoderIds.map((coderId) => [
    coderId,
    process.env[`SCENARIO_VALIDATION_${coderId.toUpperCase()}_TOKEN`] ?? ""
  ]));
  return <Trial2AdminDashboard adminToken={token} coderTokens={coderTokens} />;
}
