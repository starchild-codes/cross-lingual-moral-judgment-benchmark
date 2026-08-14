# Headline Classification Rules

The classification uses corrected exact-Wilcoxon `q_w_primary_105` values and paired-t confidence intervals.

- **Stable:** same direction, q<.05 in all versions, similar magnitude.
- **Strengthened:** same direction, validation magnitude increases meaningfully and/or q improves.
- **Weakened but survives:** same direction and q<.05 in both validation versions, with weaker magnitude or significance.
- **Weakened to suggestive:** same direction, one validation version q<.05 and the other .05<=q<.10.
- **Directionally stable but not statistically robust:** same direction but validation evidence does not meet the preceding thresholds.
- **Lost after validation:** validation q>=.10 and both paired-t confidence intervals cross zero.
- **Changed direction:** a nonzero direction reverses.
- **Not estimable:** insufficient pairs or variation.

The corrected exact permutation test changes legacy q-values. Therefore, examples based on the old asymptotic implementation are not forced onto corrected results. Tamil Loyalty/Betrayal is directionally stable but not robust (validation q=.078 and .410). Spanish Authority framing is directionally stable but not robust (q=.248 and .283), not lost, because both confidence intervals remain below zero.
