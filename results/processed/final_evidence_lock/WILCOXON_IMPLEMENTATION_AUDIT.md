# Wilcoxon Implementation Audit

## Defect Found

The legacy implementation used a tie correction that can reduce the null variance to zero when all nonzero absolute differences are tied. It then returned p=1, even when every nonzero difference had the same sign. It also used a normal approximation for most tied ordinal samples and could emit literal p=0 through floating-point tail subtraction.

## Corrected Method

The lock implementation excludes zero differences, assigns average ranks to tied absolute differences, and computes the exact two-sided random-sign permutation distribution over those assigned ranks. Integer-scaled average ranks and dynamic programming make exact calculation feasible for every observed test (maximum nonzero n=87). No asymptotic fallback is used. The two-sided p-value sums all sign assignments at least as far from the null mean as the observed positive-rank sum.

All-zero samples return p=1 with method `all_zero_no_difference`. Exact probabilities are bounded away from literal zero. Legacy literal p=0 cells found: 1; corrected literal p=0 cells: 0.

Primary BH correction covers 105 tests per analysis version. Supplementary BH correction covers 35 tests per version and effect type. Both t-test and Wilcoxon correction columns are retained.
