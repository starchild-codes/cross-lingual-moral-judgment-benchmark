# Wilcoxon Signed-Rank FDR Summary

Wilcoxon p-values are two-sided signed-rank tests on the same paired differences used by the original paired t-test tables. Zero differences are excluded from the signed-rank statistic. Exact p-values are used only when nonzero n <= 25 and the nonzero absolute differences have no ties; otherwise a normal approximation with continuity and tie correction is used.

`model_comparison` remains excluded from the primary FDR families to avoid double-counting.

## Tests Per Family

| family | tests | surviving_q_lt_05 | surviving_q_lt_10 |
| --- | --- | --- | --- |
| language_effect | 28 | 12 | 13 |
| framing_effect | 28 | 10 | 12 |
| reasoning_effect | 28 | 17 | 17 |
| foundation_breakdown | 105 | 37 | 39 |

## Strongest Surviving Findings

Sorted by absolute Cohen's d among rows with Wilcoxon q < .10.

| family | effect_type | model_key | language | mft_foundation | mean_diff | ci_lower | ci_upper | p_value_wilcoxon | q_value_bh_wilcoxon | fdr_significant_05_wilcoxon | fdr_significant_10_wilcoxon | p_value_ttest | cohens_d | n | wilcoxon_nonzero_n |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| foundation_breakdown | language | pooled | ta | Loyalty/Betrayal | -0.43333333333333335 | -0.6573668557291751 | -0.20929981093749164 | 0.000009756134429217411 | 0.0001053339016440225 | true | true | 0.0007032822603121325 | -0.6921568708897166 | 30 | 11 |
| foundation_breakdown | framing | pooled | ar | Sanctity/Degradation | -0.5925925925925926 | -0.9276818581174688 | -0.2575033270677163 | 0.00045118275754951753 | 0.002493378396984176 | true | true | 0.0018481730204056301 | -0.6670676692091927 | 27 | 13 |
| framing_effect | framing | claude | es | all | -0.42 | -0.6064892490198832 | -0.2335107509801168 | 3.197442310920451e-13 | 8.952838470577262e-12 | true | true | 0.00005571086608058273 | -0.6242615114083112 | 50 | 25 |
| foundation_breakdown | reasoning | pooled | ja | Fairness/Cheating | 0.3333333333333333 | 0.1377091726053282 | 0.5289574940613384 | 0.0000010155031442415918 | 0.00002132556602907343 | true | true | 0.0023162287902018797 | 0.6097498436202111 | 30 | 9 |
| foundation_breakdown | framing | pooled | es | Sanctity/Degradation | -0.48148148148148145 | -0.7841552963694655 | -0.17880766659349745 | 0.0003235548059832283 | 0.001887403034902165 | true | true | 0.004412390189922011 | -0.6000382376103702 | 27 | 14 |
| foundation_breakdown | framing | pooled | es | Authority/Subversion | -0.4666666666666667 | -0.7598520002813332 | -0.17348133305200014 | 0.00009964405201312587 | 0.0007052054560139354 | true | true | 0.0040697030147966995 | -0.5695868886695797 | 30 | 17 |
| foundation_breakdown | language | pooled | ar | Authority/Subversion | 0.43333333333333335 | 0.15641310608271092 | 0.7102535605839557 | 0.0018735128572680004 | 0.008941765909688183 | true | true | 0.004648510749234003 | 0.5599675523000586 | 30 | 11 |
| foundation_breakdown | language | pooled | bn | Authority/Subversion | 0.4 | 0.14092933551750347 | 0.6590706644824966 | 0.00003942330779072023 | 0.0003184190244635096 | true | true | 0.005150605165275879 | 0.5525062514530825 | 30 | 14 |
| foundation_breakdown | reasoning | pooled | ar | Fairness/Cheating | 0.4 | 0.14092933551750347 | 0.6590706644824966 | 0.00003942330779072023 | 0.0003184190244635096 | true | true | 0.005150605165275879 | 0.5525062514530825 | 30 | 14 |
| reasoning_effect | reasoning | gemini_flash | es | all | -0.34 | -0.5136000000000001 | -0.16640000000000002 | 1.9984014443252818e-15 | 5.595524044110789e-14 | true | true | 0.00035498487386376176 | -0.54287552878193 | 50 | 17 |
| framing_effect | framing | gemini_flash | es | all | -0.38 | -0.5810548183953819 | -0.1789451816046181 | 0.000007726772071947607 | 0.0000432699236029066 | true | true | 0.0005382541911156391 | -0.5238900861277119 | 50 | 21 |
| foundation_breakdown | reasoning | pooled | ja | Loyalty/Betrayal | 0.26666666666666666 | 0.08028988025427583 | 0.45304345307905747 | 0.00011476274206057013 | 0.0007088287009623449 | true | true | 0.008903704267855916 | 0.5120028248509644 | 30 | 7 |
| foundation_breakdown | language | pooled | es | Authority/Subversion | 0.36666666666666664 | 0.10959217353450645 | 0.6237411597988268 | 9.163181575733148e-7 | 0.00002132556602907343 | true | true | 0.009095904127413679 | 0.5103967334713586 | 30 | 11 |
| foundation_breakdown | language | pooled | hi | Authority/Subversion | 0.6333333333333333 | 0.18773681120103647 | 1.0789298554656301 | 0.0013418800127933395 | 0.006709400063966697 | true | true | 0.009314136259149564 | 0.5086112916652457 | 30 | 15 |
| language_effect | language | claude | ta | all | -0.4 | -0.630893915034589 | -0.16910608496541105 | 5.732159831239869e-7 | 0.000008025023763735817 | true | true | 0.0013661833858567007 | -0.4801960383990248 | 50 | 21 |
| foundation_breakdown | reasoning | pooled | ar | Authority/Subversion | -0.3 | -0.533049942849315 | -0.06695005715068506 | 0.002345925239514157 | 0.00985288600595946 | true | true | 0.017372355451692245 | -0.4606464174952623 | 30 | 9 |
| foundation_breakdown | framing | pooled | hi | Fairness/Cheating | -0.3 | -0.533049942849315 | -0.06695005715068506 | 0.000010031800156573567 | 0.0001053339016440225 | true | true | 0.017372355451692245 | -0.4606464174952623 | 30 | 12 |
| foundation_breakdown | framing | pooled | bn | Fairness/Cheating | -0.3 | -0.533049942849315 | -0.06695005715068506 | 0.000010031800156573567 | 0.0001053339016440225 | true | true | 0.017372355451692245 | -0.4606464174952623 | 30 | 12 |
| foundation_breakdown | language | pooled | all | Authority/Subversion | 0.37777777777777777 | 0.2570169005809714 | 0.49853865497458416 | 0 | 0 | true | true | 5.422230664464678e-9 | 0.4570144872999839 | 180 | 80 |
| reasoning_effect | reasoning | claude | ar | all | 0.2 | 0.07478019326001181 | 0.3252198067399882 | 0.0000010155031442415918 | 0.000004062012576966367 | true | true | 0.0029398156750055637 | 0.4427188724235732 | 50 | 9 |
| reasoning_effect | reasoning | chatgpt | ja | all | 0.3 | 0.11217028989001765 | 0.48782971010998233 | 0.0001366963749600547 | 0.0003827498498881532 | true | true | 0.0029398156750055637 | 0.44271887242357305 | 50 | 13 |
| foundation_breakdown | language | pooled | ja | Fairness/Cheating | -0.3333333333333333 | -0.604615234188884 | -0.06205143247778272 | 0.0007433868289896672 | 0.003902780852195753 | true | true | 0.022608378663814044 | -0.43969686527576396 | 30 | 14 |
| foundation_breakdown | reasoning | pooled | ja | Care/Harm | 0.2727272727272727 | 0.05909477759788795 | 0.48635976785665747 | 0.002345925239514157 | 0.00985288600595946 | true | true | 0.017647282258021146 | 0.4355724051843766 | 33 | 9 |
| foundation_breakdown | reasoning | pooled | es | Authority/Subversion | -0.3 | -0.5512837842557395 | -0.04871621574426044 | 0.00010074363657341934 | 0.0007052054560139354 | true | true | 0.026376200251361892 | -0.4272206485148892 | 30 | 9 |
| foundation_breakdown | reasoning | pooled | hi | Authority/Subversion | -0.3333333333333333 | -0.6204311112760001 | -0.04623555539066643 | 0.007280786585862398 | 0.02548275305051839 | true | true | 0.03043626010456646 | -0.41547448491940825 | 30 | 13 |
