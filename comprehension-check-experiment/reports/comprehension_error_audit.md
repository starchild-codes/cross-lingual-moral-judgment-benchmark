# Comprehension Error Audit

## Concentration

- Total incorrect items: **105**
- Questions with at least one error: **15 / 80**
- Questions missed in at least 10% of evaluations: **7**
- Questions accounting for at least half of all errors: **3**
- Largest single-question share of all errors: **25.714%**

Actor-identification errors and GPT-4o's contribution are quantified below rather than
inferred from figure appearance.

### Question Type

| question_type       | incorrect_items | percentage_of_all_errors |
| ------------------- | --------------- | ------------------------ |
| Actor               | 91              | 86.667%                  |
| Consequence/outcome | 3               | 2.857%                   |
| Main action         | 11              | 10.476%                  |
### Model

| model_key    | incorrect_items | percentage_of_all_errors |
| ------------ | --------------- | ------------------------ |
| chatgpt      | 59              | 56.190%                  |
| claude       | 26              | 24.762%                  |
| gemini_flash | 20              | 19.048%                  |
### Language

| input_language | incorrect_items | percentage_of_all_errors |
| -------------- | --------------- | ------------------------ |
| ar             | 17              | 16.190%                  |
| bn             | 23              | 21.905%                  |
| es             | 17              | 16.190%                  |
| hi             | 11              | 10.476%                  |
| ja             | 15              | 14.286%                  |
| ta             | 22              | 20.952%                  |
### Scenario

| scenario_id | incorrect_items | percentage_of_all_errors |
| ----------- | --------------- | ------------------------ |
| S02         | 3               | 2.857%                   |
| S12         | 2               | 1.905%                   |
| S18         | 11              | 10.476%                  |
| S20         | 21              | 20.000%                  |
| S22         | 4               | 3.810%                   |
| S26         | 20              | 19.048%                  |
| S28         | 27              | 25.714%                  |
| S33         | 3               | 2.857%                   |
| S40         | 1               | 0.952%                   |
| S43         | 6               | 5.714%                   |
| S47         | 1               | 0.952%                   |
| S48         | 3               | 2.857%                   |
| S49         | 3               | 2.857%                   |
### Scenario Version

| scenario_version | incorrect_items | percentage_of_all_errors |
| ---------------- | --------------- | ------------------------ |
| adapted          | 47              | 44.762%                  |
| literal          | 58              | 55.238%                  |
### Scenario Shift Tier

| shift_tier_manuscript | incorrect_items | percentage_of_all_errors |
| --------------------- | --------------- | ------------------------ |
| Higher-shift          | 82              | 78.095%                  |
| Lower-shift           | 23              | 21.905%                  |

## Questions Missed in at Least 10% of Evaluations

Each source question was attempted 36 times: three models, six languages, and two scenario
versions. No item was removed or rescored.

| question_id | scenario_id | question_type | incorrect_items | attempts | error_rate | question_en                                                                                          | correct_option | ambiguity_flag       |
| ----------- | ----------- | ------------- | --------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------- | -------------- | -------------------- |
| S28_Q1      | S28         | Actor         | 27              | 36       | 75.000%    | In the scenario concerning an error during a cash transaction, who performed the central action?     | A              | Pending human review |
| S20_Q1      | S20         | Actor         | 21              | 36       | 58.333%    | In the scenario concerning a disputed hiring decision, who performed the central action?             | B              | Pending human review |
| S18_Q1      | S18         | Actor         | 11              | 36       | 30.556%    | In the scenario concerning credit for a university report, who performed the central action?         | C              | Pending human review |
| S26_Q1      | S26         | Actor         | 10              | 36       | 27.778%    | In the scenario concerning a conflict involving weekly assistance, who performed the central action? | A              | Pending human review |
| S26_Q2      | S26         | Main action   | 10              | 36       | 27.778%    | In the scenario concerning a conflict involving weekly assistance, what central action was taken?    | B              | Pending human review |
| S43_Q1      | S43         | Actor         | 6               | 36       | 16.667%    | In the scenario concerning an evacuation during an emergency, who performed the central action?      | B              | Pending human review |
| S22_Q1      | S22         | Actor         | 4               | 36       | 11.111%    | In the scenario concerning a family name used for a snack product, who performed the central action? | B              | Pending human review |

## Item-Design Inspection

All listed items retained their externally approved wording and answer keys. The strongest
design concern is the phrase "performed the central action." For S28_Q1, 27/36 responses
selected the cashier, who performed the act of giving extra change, while the key identifies
the customer, whose act of keeping it is the intended moral target. For S20_Q1, 21/36 selected
the junior panellist, who made the biased comments, while the key identifies Chioma, whose
omission is the blameworthiness target. S18_Q1 similarly presents two substantive co-authors
and produced 11/36 errors. These are plausible competing-actor interpretations, not evidence
that response order or parsing failed.

S26_Q1 and S26_Q2 show paired actor/action mistakes, including choices contradicted by the
scenario, so genuine factual-comprehension errors also occurred. The English-source
`ambiguity_flag` field still contains the historical value `Pending human review` for the
listed questions, even though the multilingual rows were subsequently externally approved.
Thus external approval should not be treated as a psychometric guarantee that every
"central action" stem is unambiguous.

The full wording, options, keys, original flags, and model selections remain in
`question_error_rates.csv` and `missed_items.csv`. No item was removed, re-keyed, or rescored.
