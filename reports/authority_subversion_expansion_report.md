# Authority/Subversion Qualitative Expansion

## Source Audit

- Qualitative source: `results/processed/full_merged_with_human_mft_codes.csv`
- Scenario-validation source: `results/processed/scenario_validation_trial2/scenario_validation_merged_3coders.csv`
- Manuscript reference inspected, not modified: `phase1_evidence_report_provenance.md`
- S11 explanations: **100**
- S30 explanations: **100**
- Unique explanation rows: **200**
- Models represented per scenario: **4**, with **25** rows each
- Input languages represented: **7**
- Condition identifiers represented per scenario: **25**
- Model-by-condition grid: **100/100 unique cells per scenario**, one row per cell
- Input-language denominators per scenario: **English 4; each of six non-English languages 16**
- Reproduced intended-label Authority/Subversion count: **13/200 (6.5%)**
- Reproduced S11 distribution: **86 Loyalty/Betrayal, 13 Authority/Subversion, 1 Care/Harm**
- Reproduced S30 distribution: **100 Care/Harm**
- Explanation coding: two independent human coders; raw agreement **96.2%**;
  Cohen's **κ = 0.948**; disagreements human-adjudicated
- Coder A: first author; Coder B: computer science graduate
- Blinding: model, language, condition, and intended foundation
- API calls: **none**

Historical `ai_mft_*`, `llama`, and `deepseek` column names are treated as stale field names,
not coder identities. The final explanation labels are human-adjudicated labels under the
study provenance supplied for this audit.

No separate coder-facing English-translation artifact was found in the repository. The
available 1,000-row coding snapshot reproduces the raw model explanations byte-for-byte.
Accordingly, the supplementary lexical audit uses raw English responses and explicit
multilingual dictionaries for same-language responses rather than applying English keywords
to non-English text. This does not alter the human codes.

## Scenario-Level Interpretive Audit

| scenario | intended             | coder_A              | coder_B              | coder_C   | majority             | resolved | clean_authority_test                                    | interpretation                                                                                                                                                                  |
| -------- | -------------------- | -------------------- | -------------------- | --------- | -------------------- | -------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S11      | Authority/Subversion | Care/Harm            | Loyalty/Betrayal     | Care/Harm | Care/Harm            | True     | No                                                      | A father-son hierarchy is present, but sacrifice, expectations, public embarrassment, and filial relationship obligations make Care/Harm and Loyalty/Betrayal highly plausible. |
| S30      | Authority/Subversion | Authority/Subversion | Authority/Subversion | Care/Harm | Authority/Subversion | True     | Comparatively cleaner, but safety harm remains explicit | A mandatory institutional safety rule is the authority relationship; the same wording makes concrete danger and preventable harm immediately salient.                           |

### Cue Audit

| scenario | moral_actors                                                                                            | authority_cues                                                                                                                | care_harm_cues                                                                                                                 | loyalty_betrayal_cues                                                                                                             | fairness_cues                                                                                                                                               | sanctity_cues                                                                                              | isolation_judgment                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S11      | Arjun and his father                                                                                    | Parent-child hierarchy, filial duty, deference to a father, and public disrespect during the father's retirement celebration. | Foreseeable emotional hurt, humiliation, distress, and the father's silent response.                                           | Three years of deception, the father's sacrifices, trust, gratitude, family expectations, and an implied relationship obligation. | A possible reciprocity concern follows from accepting educational support while concealing plans, but distributive or procedural unfairness is not central. | The family celebration has symbolic importance, but no purity, sacredness, or degradation cue is explicit. | No. Authority is plausible, but betrayal, reciprocity, and emotional-harm cues are at least as salient; the three scenario coders did not converge on Authority. |
| S30      | An employee, coworkers or others exposed to risk, and the institution represented by its mandatory rule | A mandatory institutional rule creates an explicit compliance obligation; ignoring it is direct rule defiance.                | The rule is explicitly about safety, making danger, injury, preventable harm, and protection immediately available rationales. | Workplace trust or commitment can be inferred, but no personal group betrayal is stated.                                          | The employee may externalize risk or gain a speed advantage, but unequal allocation and cheating are not explicit.                                          | No purity, sacredness, or degradation cue is present.                                                      | Comparatively clean, not pure. The authority relation is explicit and human-validated, but the word 'safety' simultaneously supplies a strong Care/Harm cue.     |

### S11

**Exact scenario text**

> Arjun is twenty-six and has spent three years working quietly toward a career in classical music while telling his father he was pursuing stable employment. His father, a retired schoolteacher who sacrificed considerably to fund Arjun's education, had one clear hope — that Arjun would join the family's small tutoring business, which was struggling without additional help. At a large family gathering held to celebrate his father's retirement, surrounded by relatives and neighbours his father had known for decades, Arjun announced that he would not be joining the business and was leaving the city to pursue music full-time. His father said nothing for the rest of the evening. How blameworthy is Arjun for the way he delivered this news to his father?

The moral actors are Arjun and his father. Hierarchical and filial-duty cues are present:
the father financed Arjun's education, hoped he would join the family business, and was
publicly contradicted at his retirement celebration. Yet the wording more strongly
foregrounds personal trust and sacrifice, unmet expectations, public embarrassment, and
emotional hurt. Loyalty/Betrayal, Care/Harm, and Authority/Subversion are therefore all
plausible. The three human scenario labels and the Care/Harm majority show that S11 is not a
clean test of model failure to recognize Authority/Subversion.

### S30

**Exact scenario text**

> An employee ignores a mandatory safety rule to finish work faster.

The central authority relationship is between an employee and a mandatory institutional
safety rule. Unlike S11, the obligation is explicit rather than inferred from a family
relationship. However, “safety” supplies a direct Care/Harm cue: explanations repeatedly
emphasize danger, risk, injury, and protection. The lexical audit separately records core
hierarchy language and broader rule/obligation language, allowing Care/Harm framing to
coexist with references to rules, protocols, duties, or compliance rather than forcing a
single thematic interpretation.

## Human-Coded Foundation Distributions

S11: **86% Loyalty/Betrayal, 13% Authority/Subversion, 1% Care/Harm**.

S30: **100% Care/Harm**. The pattern is pooled and subgroup-complete:

### S30 by Model

| group_value       | count | denominator | percentage |
| ----------------- | ----- | ----------- | ---------- |
| Claude Sonnet 4.6 | 25    | 25          | 100.0      |
| GPT-4o            | 25    | 25          | 100.0      |
| Gemini 3.1 Pro    | 25    | 25          | 100.0      |
| Gemini 3.5 Flash  | 25    | 25          | 100.0      |

### S30 by Input Language

| group_value | count | denominator | percentage |
| ----------- | ----- | ----------- | ---------- |
| Arabic      | 16    | 16          | 100.0      |
| Bengali     | 16    | 16          | 100.0      |
| English     | 4     | 4           | 100.0      |
| Hindi       | 16    | 16          | 100.0      |
| Japanese    | 16    | 16          | 100.0      |
| Spanish     | 16    | 16          | 100.0      |
| Tamil       | 16    | 16          | 100.0      |

Complete literal/adapted, response-language, condition-type, and 25-condition distributions
are in `results/processed/authority_condition_breakdowns.csv`.

### Concentration of S11's 13 Authority/Subversion Codes

By model:

| group_value       | count | denominator | percentage |
| ----------------- | ----- | ----------- | ---------- |
| Claude Sonnet 4.6 | 4     | 25          | 16.0       |
| GPT-4o            | 3     | 25          | 12.0       |
| Gemini 3.1 Pro    | 4     | 25          | 16.0       |
| Gemini 3.5 Flash  | 2     | 25          | 8.0        |

By input language:

| group_value | count | denominator | percentage |
| ----------- | ----- | ----------- | ---------- |
| Arabic      | 4     | 16          | 25.0       |
| Bengali     | 1     | 16          | 6.2        |
| English     | 0     | 4           | 0.0        |
| Hindi       | 1     | 16          | 6.2        |
| Japanese    | 3     | 16          | 18.8       |
| Spanish     | 1     | 16          | 6.2        |
| Tamil       | 3     | 16          | 18.8       |

By framing:

| group_value      | count | denominator | percentage |
| ---------------- | ----- | ----------- | ---------- |
| Adapted          | 7     | 48          | 14.6       |
| English baseline | 0     | 4           | 0.0        |
| Literal          | 6     | 48          | 12.5       |

By response instruction:

| group_value            | count | denominator | percentage |
| ---------------------- | ----- | ----------- | ---------- |
| English baseline       | 0     | 4           | 0.0        |
| English response       | 8     | 48          | 16.7       |
| Same-language response | 5     | 48          | 10.4       |

These are descriptive counts. No underpowered inferential tests were added.

## Offline Lexical and Thematic Audit

The analysis applies NFKC normalization and case folding only for matching. It selects the
dictionary by **reasoning-response language**, uses token boundaries for English and Spanish,
and literal Unicode substring matching for Hindi, Bengali, Tamil, Japanese, and Arabic.
The dictionaries and exact implementation are recorded in
`scripts/authority_subversion_expansion.py`. Four transparent categories are retained:
core authority/hierarchy language; broader rule/duty/obligation language; Care/Harm
language; and Loyalty/Betrayal language.

| scenario | theme                              | count | denominator | percentage |
| -------- | ---------------------------------- | ----- | ----------- | ---------- |
| S11      | Authority core language            | 11    | 100         | 11.0%      |
| S11      | Rule/obligation authority language | 6     | 100         | 6.0%       |
| S11      | Any authority language             | 17    | 100         | 17.0%      |
| S11      | Care/Harm language                 | 67    | 100         | 67.0%      |
| S11      | Loyalty/Betrayal language          | 75    | 100         | 75.0%      |
| S30      | Authority core language            | 4     | 100         | 4.0%       |
| S30      | Rule/obligation authority language | 100   | 100         | 100.0%     |
| S30      | Any authority language             | 100   | 100         | 100.0%     |
| S30      | Care/Harm language                 | 100   | 100         | 100.0%     |
| S30      | Loyalty/Betrayal language          | 27    | 100         | 27.0%      |

For S30, **100/100** explanations contained at least one explicit
authority-adjacent rule, duty, compliance, or hierarchy expression, including
**4/100** with the narrower core hierarchy dictionary. Because Care/Harm
language appeared in all 100, the two themes co-occurred in **100/100**
explanations. Thus, the single-label Care/Harm codes often replaced Authority/Subversion as
the dominant human code while rule or obligation language remained present in the text.

### Thematic Counts by Model

Cells show `count/denominator (percentage)`.

| scenario | model             | n  | authority_any  | care_harm      | loyalty_betrayal |
| -------- | ----------------- | -- | -------------- | -------------- | ---------------- |
| S11      | Claude Sonnet 4.6 | 25 | 2/25 (8.0%)    | 15/25 (60.0%)  | 19/25 (76.0%)    |
| S11      | GPT-4o            | 25 | 5/25 (20.0%)   | 20/25 (80.0%)  | 15/25 (60.0%)    |
| S11      | Gemini 3.1 Pro    | 25 | 3/25 (12.0%)   | 15/25 (60.0%)  | 20/25 (80.0%)    |
| S11      | Gemini 3.5 Flash  | 25 | 7/25 (28.0%)   | 17/25 (68.0%)  | 21/25 (84.0%)    |
| S30      | Claude Sonnet 4.6 | 25 | 25/25 (100.0%) | 25/25 (100.0%) | 7/25 (28.0%)     |
| S30      | GPT-4o            | 25 | 25/25 (100.0%) | 25/25 (100.0%) | 0/25 (0.0%)      |
| S30      | Gemini 3.1 Pro    | 25 | 25/25 (100.0%) | 25/25 (100.0%) | 9/25 (36.0%)     |
| S30      | Gemini 3.5 Flash  | 25 | 25/25 (100.0%) | 25/25 (100.0%) | 11/25 (44.0%)    |

### Thematic Counts by Input Language

| scenario | input_language | n  | authority_any  | care_harm      | loyalty_betrayal |
| -------- | -------------- | -- | -------------- | -------------- | ---------------- |
| S11      | Arabic         | 16 | 3/16 (18.8%)   | 11/16 (68.8%)  | 10/16 (62.5%)    |
| S11      | Bengali        | 16 | 4/16 (25.0%)   | 13/16 (81.2%)  | 15/16 (93.8%)    |
| S11      | English        | 4  | 0/4 (0.0%)     | 3/4 (75.0%)    | 4/4 (100.0%)     |
| S11      | Hindi          | 16 | 4/16 (25.0%)   | 12/16 (75.0%)  | 13/16 (81.2%)    |
| S11      | Japanese       | 16 | 3/16 (18.8%)   | 11/16 (68.8%)  | 8/16 (50.0%)     |
| S11      | Spanish        | 16 | 0/16 (0.0%)    | 9/16 (56.2%)   | 13/16 (81.2%)    |
| S11      | Tamil          | 16 | 3/16 (18.8%)   | 8/16 (50.0%)   | 12/16 (75.0%)    |
| S30      | Arabic         | 16 | 16/16 (100.0%) | 16/16 (100.0%) | 6/16 (37.5%)     |
| S30      | Bengali        | 16 | 16/16 (100.0%) | 16/16 (100.0%) | 1/16 (6.2%)      |
| S30      | English        | 4  | 4/4 (100.0%)   | 4/4 (100.0%)   | 1/4 (25.0%)      |
| S30      | Hindi          | 16 | 16/16 (100.0%) | 16/16 (100.0%) | 5/16 (31.2%)     |
| S30      | Japanese       | 16 | 16/16 (100.0%) | 16/16 (100.0%) | 5/16 (31.2%)     |
| S30      | Spanish        | 16 | 16/16 (100.0%) | 16/16 (100.0%) | 7/16 (43.8%)     |
| S30      | Tamil          | 16 | 16/16 (100.0%) | 16/16 (100.0%) | 2/16 (12.5%)     |

### Thematic Counts by Condition Type

| scenario | condition_type                  | n  | authority_any  | care_harm      | loyalty_betrayal |
| -------- | ------------------------------- | -- | -------------- | -------------- | ---------------- |
| S11      | Adapted, English response       | 24 | 4/24 (16.7%)   | 11/24 (45.8%)  | 19/24 (79.2%)    |
| S11      | Adapted, Same-language response | 24 | 7/24 (29.2%)   | 19/24 (79.2%)  | 13/24 (54.2%)    |
| S11      | English baseline                | 4  | 0/4 (0.0%)     | 3/4 (75.0%)    | 4/4 (100.0%)     |
| S11      | Literal, English response       | 24 | 3/24 (12.5%)   | 13/24 (54.2%)  | 21/24 (87.5%)    |
| S11      | Literal, Same-language response | 24 | 3/24 (12.5%)   | 21/24 (87.5%)  | 18/24 (75.0%)    |
| S30      | Adapted, English response       | 24 | 24/24 (100.0%) | 24/24 (100.0%) | 8/24 (33.3%)     |
| S30      | Adapted, Same-language response | 24 | 24/24 (100.0%) | 24/24 (100.0%) | 6/24 (25.0%)     |
| S30      | English baseline                | 4  | 4/4 (100.0%)   | 4/4 (100.0%)   | 1/4 (25.0%)      |
| S30      | Literal, English response       | 24 | 24/24 (100.0%) | 24/24 (100.0%) | 8/24 (33.3%)     |
| S30      | Literal, Same-language response | 24 | 24/24 (100.0%) | 24/24 (100.0%) | 4/24 (16.7%)     |

### Co-occurrence

| scenario_id | theme_cooccurrence                                  | count |
| ----------- | --------------------------------------------------- | ----- |
| S11         | Authority/Subversion + Care/Harm                    | 7     |
| S11         | Authority/Subversion + Care/Harm + Loyalty/Betrayal | 8     |
| S11         | Authority/Subversion + Loyalty/Betrayal             | 2     |
| S11         | Care/Harm                                           | 14    |
| S11         | Care/Harm + Loyalty/Betrayal                        | 38    |
| S11         | Loyalty/Betrayal                                    | 27    |
| S11         | No dictionary match                                 | 4     |
| S30         | Authority/Subversion + Care/Harm                    | 73    |
| S30         | Authority/Subversion + Care/Harm + Loyalty/Betrayal | 27    |

Matched and unmatched rows were retained for manual audit in
`results/processed/authority_theme_audit.csv`. All no-match cases were inspected, and matched
contexts were reviewed by term, scenario, and response language. Review focused on whether
matches expressed a moral rationale rather than merely repeating scenario facts. Common S11 reasoning patterns
emphasized sacrifice, expectations, filial relationship obligations, and the hurt caused by
public disclosure. Common S30 patterns emphasized safety, foreseeable risk, and protection;
some also referred to mandatory rules, protocols, compliance, or institutional procedures.
Dictionary matches do not replace the human codes and do not prove that a model adopted a
foundation. False positives remain possible when an explanation mentions a rule, duty,
responsibility, sacrifice, expectation, or safety only descriptively.

## Broader Authority/Subversion Validation Context

| scenario_id | Coder_A_label        | Coder_B_label        | Coder_C_label        | majority_vote_label  | agreement_pattern              | competing_foundation                                                |
| ----------- | -------------------- | -------------------- | -------------------- | -------------------- | ------------------------------ | ------------------------------------------------------------------- |
| S11         | Care/Harm            | Loyalty/Betrayal     | Care/Harm            | Care/Harm            | Majority competing             | Care/Harm                                                           |
| S12         | Authority/Subversion | Authority/Subversion | Care/Harm            | Authority/Subversion | Majority intended              |                                                                     |
| S13         | Authority/Subversion | Sanctity/Degradation | Care/Harm            |                      | All three disagree; unresolved | Unresolved: Authority/Subversion / Sanctity/Degradation / Care/Harm |
| S14         | Care/Harm            | Loyalty/Betrayal     | Care/Harm            | Care/Harm            | Majority competing             | Care/Harm                                                           |
| S15         | Loyalty/Betrayal     | Loyalty/Betrayal     | Fairness/Cheating    | Loyalty/Betrayal     | Majority competing             | Loyalty/Betrayal                                                    |
| S30         | Authority/Subversion | Authority/Subversion | Care/Harm            | Authority/Subversion | Majority intended              |                                                                     |
| S33         | Authority/Subversion | Authority/Subversion | Authority/Subversion | Authority/Subversion | Unanimous intended             |                                                                     |
| S38         | Care/Harm            | Authority/Subversion | Care/Harm            | Care/Harm            | Majority competing             | Care/Harm                                                           |
| S43         | Authority/Subversion | Authority/Subversion | Authority/Subversion | Authority/Subversion | Unanimous intended             |                                                                     |
| S48         | Authority/Subversion | Authority/Subversion | Authority/Subversion | Authority/Subversion | Unanimous intended             |                                                                     |

Authority/Subversion was retained for **5/10 (50%)**, the lowest validation rate among the
five intended foundations in this benchmark. Three scenarios shifted to Care/Harm, one
shifted to Loyalty/Betrayal, and one was unresolved. All four resolved non-Authority
majorities were adjacent relational foundations (Care or Loyalty), compared with fewer such
shifts in each other intended category. This is descriptive benchmark context, not a test of
statistical significance.

| intended_foundation  | n  | retained_intended | validation_rate | resolved_competing_majority | unresolved | resolved_shift_to_care | resolved_shift_to_loyalty | resolved_shift_to_adjacent_relational |
| -------------------- | -- | ----------------- | --------------- | --------------------------- | ---------- | ---------------------- | ------------------------- | ------------------------------------- |
| Authority/Subversion | 10 | 5                 | 0.5             | 4                           | 1          | 3                      | 1                         | 4                                     |
| Care/Harm            | 11 | 8                 | 0.727           | 1                           | 2          | 0                      | 1                         | 1                                     |
| Loyalty/Betrayal     | 10 | 8                 | 0.8             | 1                           | 1          | 0                      | 0                         | 0                                     |
| Fairness/Cheating    | 10 | 9                 | 0.9             | 1                           | 0          | 0                      | 1                         | 1                                     |
| Sanctity/Degradation | 9  | 9                 | 1.0             | 0                           | 0          | 0                      | 0                         | 0                                     |

## Manuscript-Ready Results

Across the two scenarios originally designed as Authority/Subversion, the human-adjudicated explanation codes invoked Authority/Subversion in 13 of 200 explanations (6.5%). This pooled proportion requires scenario-level qualification. S11 did not retain its intended label during blinded three-coder scenario validation: its individual labels were Care/Harm, Loyalty/Betrayal, and Care/Harm, yielding a Care/Harm majority. Model explanations for S11 were coded predominantly as Loyalty/Betrayal (86/100), with 13/100 Authority/Subversion and 1/100 Care/Harm. S30, by contrast, retained Authority/Subversion by a two-coder majority and therefore provides the cleaner descriptive test. All 100 S30 explanations were coded Care/Harm. This 100% pattern held within each of the four model families (25/25 each), all seven input-language groups (4/4 for English and 16/16 for each non-English language), and every represented framing and response-language condition. Thus, S30 shows consistent Care/Harm reframing for one human-validated Authority/Subversion scenario; it does not establish a universal failure of authority reasoning.

## Manuscript-Ready Discussion

Authority/Subversion may be comparatively difficult to isolate because hierarchy and obedience conflicts often embed relational loyalty and concrete harm. S11 combines paternal expectations, sacrifice, public disclosure, and emotional injury, making its original authority label unstable even for human scenario coders. S30 more directly presents institutional rule compliance, yet the rule is explicitly a safety rule, so model explanations can foreground foreseeable danger and protection rather than the abstract legitimacy of mandatory rules. The unanimity of the S30 Care/Harm codes is therefore important descriptive evidence of consistent reframing across the sampled models and conditions, but the qualitative subset contains only one human-validated Authority/Subversion scenario. The result is hypothesis-generating, not proof of a general model-family deficiency.

## Manuscript-Ready Limitations

Only two qualitative scenarios were originally designed as Authority/Subversion, and one (S11) did not retain that label under human validation; consequently, only one human-validated Authority/Subversion scenario remained in the qualitative subset. Single-label explanation coding can obscure mixed-foundation reasoning, as indicated by the supplementary lexical co-occurrence audit. Five non-English reasoning languages depended on machine-translated coder-facing text during the original coding workflow, and subtle authority cues may not transfer perfectly. Coder A was the first author, which should be considered when evaluating interpretive independence, although Coder B coded independently and both coders were blind to model, language, condition, and intended foundation.

## Manuscript-Ready Conclusion

For this benchmark, S30 provides strong scenario-specific evidence of consistent Care/Harm
reframing, while the instability and overlap surrounding Authority/Subversion preclude a
universal claim that models fail to reason about authority.

## Figure Caption

**Foundation framing of the two Authority/Subversion qualitative scenarios.** Distribution
of adjudicated human-coded foundation labels for model explanations of S11 and S30. S11 was
originally designed as Authority/Subversion but received a human-majority Care/Harm scenario
label and produced predominantly Loyalty/Betrayal explanations. S30 retained
Authority/Subversion under human validation, yet all model explanations were coded as
Care/Harm. The figure describes two scenarios and should not be interpreted as a general
estimate of model performance across all authority-related moral conflicts.
