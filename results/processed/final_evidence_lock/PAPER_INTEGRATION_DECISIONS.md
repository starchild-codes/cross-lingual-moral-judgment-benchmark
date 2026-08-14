# Paper Integration Decisions

1. Do not call the 1,000 explanation labels human-coded, human-adjudicated, or human ground truth. Describe them as two independent non-evaluated LLM coders with manual adjudication.
2. Reserve “human coders” for the distinct blinded 50-scenario validation.
3. Report corrected exact Wilcoxon results and the 105-test BH family as primary; the 35-test family is supplementary.
4. Replace “lost significance” with the lock classifications, including “weakened to suggestive” where q is between .05 and .10.
5. Qualify Authority/Subversion generalization because scenario validation retained only half of intended Authority scenarios and the qualitative subset has two Authority-designed targets.
6. Treat S30 as strong descriptive evidence for one human-validated scenario, not a population estimate.
