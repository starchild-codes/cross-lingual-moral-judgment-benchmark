# Hosted Scenario Validation: Trial 2

The hosted system provides three private coder routes and a protected admin dashboard:

- `/validate/Coder_A?token=...`
- `/validate/Coder_B?token=...`
- `/validate/Coder_C?token=...`
- `/validate/admin?token=...`

Supabase is the persistent source of truth. Browser localStorage is only a recovery backup.

## Setup

1. Create a Supabase project.
2. Run `supabase/scenario-validation-trial2.sql` in the Supabase SQL Editor.
3. Add the six variables shown in `.env.local.example` to `.env.local` and Vercel.
4. Run:

```powershell
corepack pnpm scenario-validation-trial2-extract
corepack pnpm scenario-validation-trial2-test
corepack pnpm scenario-validation-trial2-seed
```

5. Upload the project to a private GitHub repository and import it as a new Vercel project.
6. Add the same six environment variables in Vercel before deployment.
7. Open the deployed `/validate/admin?token=YOUR_ADMIN_TOKEN` page and copy the three private coder links.

Never commit `.env.local`, expose the Supabase secret/service-role key, or give a coder another coder's URL.

## Final Analysis

Download each coder CSV from the admin dashboard into `results/processed/scenario_validation_trial2/`, then run:

```powershell
corepack pnpm scenario-validation-trial2-stats
```

The script computes pairwise raw agreement, pairwise Cohen's kappa, mean pairwise kappa, Fleiss' kappa, majority-vote validation, by-foundation validation, and Authority/Subversion validation.
