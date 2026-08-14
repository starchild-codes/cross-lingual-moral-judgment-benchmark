# Hosted Three-Coder Scenario Validation (Trial 2)

This is the deployment and operating guide for the second, independent scenario-foundation validation. It does not overwrite the earlier two-coder pilot.

## Architecture

- Next.js coder pages: `/validate/Coder_A`, `/validate/Coder_B`, `/validate/Coder_C`
- Protected admin page: `/validate/admin`
- Supabase PostgreSQL is the persistent source of truth.
- Per-coder URL tokens are checked by the Next.js server before any response can be read or saved.
- The Supabase service-role key is server-only. It must never use a `NEXT_PUBLIC_` prefix.
- Browser localStorage is only a recovery backup. Successful saves are upserted immediately to Supabase.
- The admin key is server-side and is never returned by coder routes or coder CSV exports.

## 1. Prepare Trial 2 Data

From the project root:

```powershell
corepack pnpm scenario-validation-trial2-extract
corepack pnpm scenario-validation-trial2-test
```

This creates the coder-safe 50-scenario JSON, the admin-only key, and the placeholder Methods file in this folder.

## 2. Create Supabase Tables

1. Create a new Supabase project at https://supabase.com.
2. Open **SQL Editor** in that project.
3. Run the complete SQL file `supabase/scenario-validation-trial2.sql`.
4. In **Project Settings > API**, copy the project URL and service-role key.

The SQL enables row-level security and deliberately creates no public/anonymous policies. Only the deployed server, after token validation, uses the service role.

## 3. Configure Secrets

Generate four independent long tokens (run this command four times):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add these variables to `.env.local` for local setup and to the deployment platform's encrypted environment variables:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
SCENARIO_VALIDATION_CODER_A_TOKEN=REPLACE_WITH_NEW_PRIVATE_TOKEN
SCENARIO_VALIDATION_CODER_B_TOKEN=REPLACE_WITH_NEW_PRIVATE_TOKEN
SCENARIO_VALIDATION_CODER_C_TOKEN=REPLACE_WITH_NEW_PRIVATE_TOKEN
SCENARIO_VALIDATION_ADMIN_TOKEN=REPLACE_WITH_NEW_PRIVATE_TOKEN
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or rename it with a `NEXT_PUBLIC_` prefix.

## 4. Seed Supabase

After the tables and local environment variables are ready:

```powershell
corepack pnpm scenario-validation-trial2-seed
```

This upserts exactly 50 scenario rows, including the intended labels used only for administration and analysis.

## 5. Test Locally

```powershell
corepack pnpm dev
```

Open the private admin page:

```text
http://localhost:3000/validate/admin?token=YOUR_RANDOM_ADMIN_TOKEN
```

The admin page displays and copies the three complete coder links. Test one label, refresh, and confirm the response is restored from secure storage.

## 6. Deploy to Vercel

1. Push this project to a private Git repository.
2. Import the repository at https://vercel.com/new.
3. Keep the detected Next.js build settings (`pnpm build`).
4. Add all six environment variables from section 3 to Production, Preview, and Development as appropriate.
5. Deploy.
6. Open `https://YOUR_DEPLOYMENT/validate/admin?token=YOUR_RANDOM_ADMIN_TOKEN`.
7. Copy the three coder links from the admin dashboard and send each coder only their own link.

The same setup also works on another hosting service that supports Next.js server routes and encrypted server environment variables. Static-only hosting is not sufficient because saving requires server API routes.

## Coder Links

After deployment, links have this form:

```text
https://YOUR_DEPLOYMENT/validate/Coder_A?token=REPLACE_WITH_PRIVATE_TOKEN
https://YOUR_DEPLOYMENT/validate/Coder_B?token=REPLACE_WITH_PRIVATE_TOKEN
https://YOUR_DEPLOYMENT/validate/Coder_C?token=REPLACE_WITH_PRIVATE_TOKEN
```

Coder IDs are always stored exactly as `Coder_A`, `Coder_B`, and `Coder_C`. Each deterministic scenario order differs by coder ID.

## Admin Exports

The admin dashboard provides individual coder CSV downloads and a merged coder-safe CSV. Save the individual downloads at:

```text
results/processed/scenario_validation_trial2/scenario_validation_Coder_A.csv
results/processed/scenario_validation_trial2/scenario_validation_Coder_B.csv
results/processed/scenario_validation_trial2/scenario_validation_Coder_C.csv
```

Coder exports contain no intended-foundation column.

## Run Final Statistics

After all three coders have submitted:

```powershell
corepack pnpm scenario-validation-trial2-stats
```

You can also provide downloaded files from another location:

```powershell
corepack pnpm scenario-validation-trial2-stats -- --coder-a "PATH_A.csv" --coder-b "PATH_B.csv" --coder-c "PATH_C.csv"
```

The script validates all IDs and labels, computes three pairwise raw agreements and Cohen's kappas, mean pairwise kappa, Fleiss' kappa, majority-vote validation, by-foundation validation, and Authority/Subversion detail.

## Final Output Files

1. `scenario_validation_Coder_A.csv`
2. `scenario_validation_Coder_B.csv`
3. `scenario_validation_Coder_C.csv`
4. `scenario_validation_merged_3coders.csv`
5. `scenario_validation_summary_3coders.csv`
6. `scenario_validation_by_foundation_3coders.csv`
7. `authority_subversion_validation_detail_3coders.csv`
8. `scenario_validation_disagreements_3coders.csv`
9. `scenario_validation_methods_3coders.md`
10. `scenario_validation_admin_key.csv`

## Security and Completion Checks

- Coders receive only their own private token and responses.
- Coder routes never return intended labels or other coders' labels.
- Final submission is rejected until all 50 unique scenarios have valid labels.
- Final submission locks that coder's database rows.
- The admin page is protected by a separate token.
- Supabase, not localStorage, is the persistent source of truth.
- Refresh/resume loads saved progress from Supabase on any device using the same private coder link.
