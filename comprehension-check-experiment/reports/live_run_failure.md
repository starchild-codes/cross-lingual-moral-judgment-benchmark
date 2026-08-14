# Live Comprehension Run: Stopped

## Stop condition

Collection stopped at `S02__ja__literal__chatgpt` after all three configured attempts failed the strict
parser requirement: exactly four comma-separated letters A-D.

No model, prompt, temperature, scenario, question, answer key, token limit, reasoning
effort, parser, or retry-limit change was made. No fourth request was attempted.

## Preserved evidence

- Replacement smoke test: **3/3 passed**
- Successful unique full-run rows committed: **26/720**
- Attempt rows retained: **31**
- Failed attempt rows retained: **5**
- Duplicate final results: **0**
- Exact model IDs remained consistent: **Yes**
- Request parameter signatures remained consistent within each model: **Yes**
- Partial-run snapshot: `C:\Users\anshi\OneDrive\เอกสาร\AI researcher\comprehension-check-experiment\results\archive\full_stopped_20260727T100053Z`

The runner version active for the failed target attempts did not retain response bodies
when strict parsing failed. That failure-capture path has been corrected prospectively,
but the missing bodies were not reconstructed and no additional call was made.

## Observed costs

- Archived unauthorized smoke: **$0.0000000**
- Successful replacement smoke: **$0.0053375**
- Successful post-smoke collection: **$0.0419270**
- Successful locally observed total: **$0.0472645**

Parse-failed responses and any requests already running when the parallel executor stopped
may have provider charges that are absent from the local database. A precise combined billed
total therefore cannot be established from local evidence alone.

## Analysis status

Final comprehension analyses, figures, and plotting data were not generated because the
required 720 unique valid rows were not reached. Producing final summaries from 26 rows
would be incomplete and misleading.
