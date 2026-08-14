# Scenario Foundation Validation Workflow

Coder A has been cleaned from the completed full blinded export:

- `coder_A_scenario_validation_cleaned.csv`

Coder B should use:

http://localhost:3000/scenario-validation?coder=Coder_B

This opens the full blinded 50-scenario interface, auto-sets `coder_id = Coder_B`, hides intended foundations and Coder A labels, and uses a Coder-B-specific randomized order. When all 50 scenarios are labelled, click **Save Coder B CSV** to write:

- `coder_B_scenario_validation.csv`

After Coder B is saved, compute validation outputs:

```powershell
corepack pnpm scenario-validation-pipeline -- compute
```

This writes the merged validation file, summary metrics, by-foundation table, Authority/Subversion detail table, three confusion matrices, adjudication template, and paper-ready methods paragraph in this folder.
