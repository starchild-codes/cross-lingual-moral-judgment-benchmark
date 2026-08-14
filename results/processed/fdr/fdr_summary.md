# Benjamini-Hochberg FDR Summary

Primary FDR families: `language_effect`, `framing_effect`, `reasoning_effect`, and `foundation_breakdown`.

`model_comparison` is excluded from the primary FDR family because it duplicates model-specific language/framing/reasoning rows already represented in the primary effect tables. It can remain an appendix/reporting table, but it is not counted here.

## Tests Per Family

| family | tests | surviving_q_lt_05 | surviving_q_lt_10 |
| --- | --- | --- | --- |
| language_effect | 28 | 3 | 4 |
| framing_effect | 28 | 6 | 11 |
| reasoning_effect | 28 | 10 | 13 |
| foundation_breakdown | 105 | 14 | 25 |

## Strongest Surviving Findings

Sorted by absolute Cohen's d among rows with q < .10.

| family | effect_type | model_key | language | mft_foundation | mean_diff | ci_lower | ci_upper | p_value | q_value_bh | fdr_significant_05 | fdr_significant_10 | cohens_d | n |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| foundation_breakdown | language | pooled | ta | Loyalty/Betrayal | -0.43333333333333335 | -0.6573668557291751 | -0.20929981093749164 | 0.0007032822603121325 | 0.02461487911092464 | true | true | -0.6921568708897166 | 30 |
| foundation_breakdown | framing | pooled | ar | Sanctity/Degradation | -0.5925925925925926 | -0.9276818581174688 | -0.2575033270677163 | 0.0018481730204056301 | 0.02798138646491588 | true | true | -0.6670676692091927 | 27 |
| framing_effect | framing | claude | es | all | -0.42 | -0.6064892490198832 | -0.2335107509801168 | 0.00005571086608058273 | 0.0005199680834187722 | true | true | -0.6242615114083112 | 50 |
| foundation_breakdown | reasoning | pooled | ja | Fairness/Cheating | 0.3333333333333333 | 0.1377091726053282 | 0.5289574940613384 | 0.0023162287902018797 | 0.02798138646491588 | true | true | 0.6097498436202111 | 30 |
| foundation_breakdown | framing | pooled | es | Sanctity/Degradation | -0.48148148148148145 | -0.7841552963694655 | -0.17880766659349745 | 0.004412390189922011 | 0.03862953873956909 | true | true | -0.6000382376103702 | 27 |
| foundation_breakdown | framing | pooled | es | Authority/Subversion | -0.4666666666666667 | -0.7598520002813332 | -0.17348133305200014 | 0.0040697030147966995 | 0.03862953873956909 | true | true | -0.5695868886695797 | 30 |
| foundation_breakdown | language | pooled | ar | Authority/Subversion | 0.43333333333333335 | 0.15641310608271092 | 0.7102535605839557 | 0.004648510749234003 | 0.03862953873956909 | true | true | 0.5599675523000586 | 30 |
| foundation_breakdown | language | pooled | bn | Authority/Subversion | 0.4 | 0.14092933551750347 | 0.6590706644824966 | 0.005150605165275879 | 0.03862953873956909 | true | true | 0.5525062514530825 | 30 |
| foundation_breakdown | reasoning | pooled | ar | Fairness/Cheating | 0.4 | 0.14092933551750347 | 0.6590706644824966 | 0.005150605165275879 | 0.03862953873956909 | true | true | 0.5525062514530825 | 30 |
| reasoning_effect | reasoning | gemini_flash | es | all | -0.34 | -0.5136000000000001 | -0.16640000000000002 | 0.00035498487386376176 | 0.004969788234092665 | true | true | -0.54287552878193 | 50 |
| framing_effect | framing | gemini_flash | es | all | -0.38 | -0.5810548183953819 | -0.1789451816046181 | 0.0005382541911156391 | 0.003767779337809474 | true | true | -0.5238900861277119 | 50 |
| foundation_breakdown | reasoning | pooled | ja | Loyalty/Betrayal | 0.26666666666666666 | 0.08028988025427583 | 0.45304345307905747 | 0.008903704267855916 | 0.05752848865945319 | false | true | 0.5120028248509644 | 30 |
| foundation_breakdown | language | pooled | es | Authority/Subversion | 0.36666666666666664 | 0.10959217353450645 | 0.6237411597988268 | 0.009095904127413679 | 0.05752848865945319 | false | true | 0.5103967334713586 | 30 |
| foundation_breakdown | language | pooled | hi | Authority/Subversion | 0.6333333333333333 | 0.18773681120103647 | 1.0789298554656301 | 0.009314136259149564 | 0.05752848865945319 | false | true | 0.5086112916652457 | 30 |
| foundation_breakdown | language | pooled | ja | Authority/Subversion | 0.3 | 0.08673722431175929 | 0.5132627756882406 | 0.009981299458980075 | 0.05822424684405044 | false | true | 0.5033865892655734 | 30 |
| language_effect | language | claude | ta | all | -0.4 | -0.630893915034589 | -0.16910608496541105 | 0.0013661833858567007 | 0.01658297071337629 | true | true | -0.4801960383990248 | 50 |
| foundation_breakdown | reasoning | pooled | ar | Care/Harm | 0.18181818181818182 | 0.048181818181818215 | 0.31545454545454543 | 0.011914159437192984 | 0.06254933704526316 | false | true | 0.4642070825485277 | 33 |
| foundation_breakdown | reasoning | pooled | ar | Authority/Subversion | -0.3 | -0.533049942849315 | -0.06695005715068506 | 0.017372355451692245 | 0.07720685987884252 | false | true | -0.4606464174952623 | 30 |
| foundation_breakdown | framing | pooled | hi | Fairness/Cheating | -0.3 | -0.533049942849315 | -0.06695005715068506 | 0.017372355451692245 | 0.07720685987884252 | false | true | -0.4606464174952623 | 30 |
| foundation_breakdown | framing | pooled | bn | Fairness/Cheating | -0.3 | -0.533049942849315 | -0.06695005715068506 | 0.017372355451692245 | 0.07720685987884252 | false | true | -0.4606464174952623 | 30 |
| foundation_breakdown | language | pooled | all | Authority/Subversion | 0.37777777777777777 | 0.2570169005809714 | 0.49853865497458416 | 5.422230664464678e-9 | 5.693342197687912e-7 | true | true | 0.4570144872999839 | 180 |
| reasoning_effect | reasoning | claude | ar | all | 0.2 | 0.07478019326001181 | 0.3252198067399882 | 0.0029398156750055637 | 0.02057870972503895 | true | true | 0.4427188724235732 | 50 |
| reasoning_effect | reasoning | chatgpt | ja | all | 0.3 | 0.11217028989001765 | 0.48782971010998233 | 0.0029398156750055637 | 0.02057870972503895 | true | true | 0.44271887242357305 | 50 |
| foundation_breakdown | language | pooled | ja | Fairness/Cheating | -0.3333333333333333 | -0.604615234188884 | -0.06205143247778272 | 0.022608378663814044 | 0.09495519038801899 | false | true | -0.43969686527576396 | 30 |
| foundation_breakdown | reasoning | pooled | ja | Care/Harm | 0.2727272727272727 | 0.05909477759788795 | 0.48635976785665747 | 0.017647282258021146 | 0.07720685987884252 | false | true | 0.4355724051843766 | 33 |

## Raw Headline Findings That Do Not Survive FDR

This compares the top raw-p/effect-size headline candidates from the primary families only. The duplicated `model_comparison` headline and reference-divergence rows are not part of this FDR test family.

### Do Not Survive q < .05

All primary raw headline candidates survive q < .05.

### Do Not Survive q < .10

All primary raw headline candidates survive q < .10.
