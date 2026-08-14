"""
FDR Correction Analysis for Reddit AI Discourse Paper
=====================================================

This script applies Benjamini-Hochberg FDR correction to:

1. Kruskal-Wallis omnibus tests across linguistic metrics
2. Dunn pairwise post-hoc tests across metrics and tier pairs
3. Partial correlations controlling for post length

Outputs:
- fdr_kruskal_omnibus.csv
- fdr_dunn_pairwise.csv
- fdr_partial_correlations.csv
- fdr_summary.txt

Designed for Anshima's Reddit AI discourse paper.
"""

import os
import re
import warnings
import numpy as np
import pandas as pd
from scipy import stats

warnings.filterwarnings("ignore")

try:
    import scikit_posthocs as sp
except ImportError:
    sp = None

try:
    import pingouin as pg
except ImportError:
    pg = None

try:
    import textstat
except ImportError:
    textstat = None


# ── CONFIG ────────────────────────────────────────────────────────────────────

BASE_PATH = r"C:\Users\anshi\OneDrive\Desktop"
ENRICHED_CSV_PATH = os.path.join(BASE_PATH, "reddit_data_clean_with_acronyms.csv")
ORIGINAL_CSV_PATH = os.path.join(BASE_PATH, "reddit_data_clean.csv")

OUTPUT_DIR = BASE_PATH

TIER_COL = "expertise_tier"
WORD_COUNT_COL = "word_count"

TIER_ORDER = ["low", "medium", "high"]
TIER_MAP = {"low": 0, "medium": 1, "high": 2}

ACRONYM_RE = re.compile(r"\b[A-Z]{2,}(?:[-]?[A-Z0-9]+)*\b")


# Main linguistic metric family
MAIN_METRICS = [
    "fk_grade",
    "gunning_fog",
    "smog",
    "avg_sentence_length",
    "avg_syllables_per_word",
    "type_token_ratio",
    "mattr",
    "hedge_per_100",
    "causal_per_100",
    "sentiment_pos",
    "sentiment_neg",
    "sentiment_neu",
    "sentiment_compound",
]

# Robustness/acronym family
ACRONYM_METRICS = [
    "acronym_density_per_100_words",
    "avg_syllables_per_word_without_acronyms",
    "avg_syllables_per_word_acronyms_normalized",
]

ALL_METRICS = MAIN_METRICS + ACRONYM_METRICS


# ── HELPERS ───────────────────────────────────────────────────────────────────

def bh_fdr(p_values, alpha=0.05):
    """
    Benjamini-Hochberg FDR correction without requiring statsmodels.
    Returns adjusted p-values and rejection decisions.
    """
    p_values = np.array(p_values, dtype=float)
    n = len(p_values)

    adjusted = np.full(n, np.nan)
    reject = np.full(n, False)

    valid_mask = ~np.isnan(p_values)
    valid_p = p_values[valid_mask]

    if len(valid_p) == 0:
        return adjusted, reject

    order = np.argsort(valid_p)
    ranked_p = valid_p[order]
    m = len(valid_p)

    adjusted_ranked = ranked_p * m / np.arange(1, m + 1)

    # Enforce monotonicity from largest to smallest
    adjusted_ranked = np.minimum.accumulate(adjusted_ranked[::-1])[::-1]
    adjusted_ranked = np.minimum(adjusted_ranked, 1.0)

    reject_ranked = adjusted_ranked < alpha

    valid_indices = np.where(valid_mask)[0]
    adjusted_valid = np.empty(m)
    reject_valid = np.empty(m, dtype=bool)

    adjusted_valid[order] = adjusted_ranked
    reject_valid[order] = reject_ranked

    adjusted[valid_indices] = adjusted_valid
    reject[valid_indices] = reject_valid

    return adjusted, reject


def p_text(p):
    if pd.isna(p):
        return "NA"
    if p < 0.001:
        return "<.001"
    return f"{p:.4f}"


def simple_syllable_count_word(word):
    word = str(word).lower().strip(".,!?;:'\"()[]{}")
    if not word:
        return 0

    vowels = "aeiouy"
    count = 0
    prev_vowel = False

    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel

    if word.endswith("e") and count > 1:
        count -= 1

    return max(count, 1)


def avg_syllables_per_word_text(text):
    text = str(text)
    words = text.split()

    if len(words) == 0:
        return np.nan

    if textstat is not None:
        try:
            syl = textstat.syllable_count(text)
            return syl / len(words)
        except Exception:
            pass

    syl = sum(simple_syllable_count_word(w) for w in words)
    return syl / len(words)


def compute_acronym_metrics_if_needed(df):
    needed = [
        "acronym_density_per_100_words",
        "avg_syllables_per_word_without_acronyms",
        "avg_syllables_per_word_acronyms_normalized",
    ]

    if all(col in df.columns for col in needed):
        print("Acronym metrics already available.")
        return df

    print("Computing acronym metrics...")

    text_col = "text_clean" if "text_clean" in df.columns else "text"

    if text_col not in df.columns:
        print("No text/text_clean column found. Acronym metrics skipped.")
        return df

    def process_text(text):
        text = str(text)
        words = text.split()
        wc = len(words)

        acronyms = ACRONYM_RE.findall(text)
        acronym_count = len(acronyms)

        acronym_density = (acronym_count / wc * 100) if wc > 0 else np.nan

        text_without_acronyms = ACRONYM_RE.sub("", text)
        avg_without = avg_syllables_per_word_text(text_without_acronyms)

        text_normalized = ACRONYM_RE.sub("term", text)
        avg_normalized = avg_syllables_per_word_text(text_normalized)

        return pd.Series({
            "acronym_count": acronym_count,
            "acronym_density_per_100_words": acronym_density,
            "avg_syllables_per_word_without_acronyms": avg_without,
            "avg_syllables_per_word_acronyms_normalized": avg_normalized,
        })

    acronym_df = df[text_col].apply(process_text)

    for col in acronym_df.columns:
        df[col] = acronym_df[col]

    enriched_path = os.path.join(OUTPUT_DIR, "reddit_data_clean_with_acronyms.csv")
    df.to_csv(enriched_path, index=False)
    print(f"Saved enriched data → {enriched_path}")

    return df


def kruskal_for_metric(df, metric):
    groups = []

    for tier in TIER_ORDER:
        vals = df[df[TIER_COL] == tier][metric].dropna()
        groups.append(vals)

    if any(len(g) < 2 for g in groups):
        return np.nan, np.nan

    try:
        H, p = stats.kruskal(*groups)
        return H, p
    except Exception:
        return np.nan, np.nan


def dunn_for_metric(df, metric):
    if sp is None:
        return []

    clean = df[[TIER_COL, metric]].dropna().copy()

    if clean[TIER_COL].nunique() < 3:
        return []

    try:
        dunn = sp.posthoc_dunn(
            clean,
            val_col=metric,
            group_col=TIER_COL,
            p_adjust=None
        )

        rows = []

        pairs = [
            ("low", "medium"),
            ("low", "high"),
            ("medium", "high"),
        ]

        for a, b in pairs:
            if a in dunn.index and b in dunn.columns:
                p = dunn.loc[a, b]
            elif b in dunn.index and a in dunn.columns:
                p = dunn.loc[b, a]
            else:
                p = np.nan

            rows.append({
                "metric": metric,
                "pair": f"{a}_vs_{b}",
                "raw_p": p,
            })

        return rows

    except Exception:
        return []


def partial_corr_for_metric(df, metric, covariates):
    if pg is None:
        return np.nan, np.nan

    needed_cols = [metric, "tier_numeric"] + covariates
    missing = [c for c in needed_cols if c not in df.columns]

    if missing:
        return np.nan, np.nan

    clean = df[needed_cols].dropna().copy()

    if len(clean) < 10:
        return np.nan, np.nan

    try:
        res = pg.partial_corr(
            data=clean,
            x=metric,
            y="tier_numeric",
            covar=covariates
        )

        r = res["r"].values[0]

        p_col = None
        for candidate in ["p-val", "p_val", "pval", "p.val"]:
            if candidate in res.columns:
                p_col = candidate
                break

        p = res[p_col].values[0] if p_col else np.nan

        return r, p

    except Exception:
        return np.nan, np.nan


# ── MAIN ──────────────────────────────────────────────────────────────────────

print("=" * 80)
print("FDR CORRECTION ANALYSIS")
print("=" * 80)

if os.path.exists(ENRICHED_CSV_PATH):
    csv_path = ENRICHED_CSV_PATH
else:
    csv_path = ORIGINAL_CSV_PATH

print(f"\nLoading data from: {csv_path}")
df = pd.read_csv(csv_path)
print(f"{len(df)} posts loaded.")

df[TIER_COL] = df[TIER_COL].astype(str).str.lower().str.strip()
df["tier_numeric"] = df[TIER_COL].map(TIER_MAP)

if df["tier_numeric"].isna().any():
    bad = df[df["tier_numeric"].isna()][TIER_COL].unique()
    raise ValueError(f"Unrecognized tier labels: {bad}")

df = compute_acronym_metrics_if_needed(df)

available_metrics = [m for m in ALL_METRICS if m in df.columns]
missing_metrics = [m for m in ALL_METRICS if m not in df.columns]

print("\nAvailable metrics:")
for m in available_metrics:
    print(f"  - {m}")

if missing_metrics:
    print("\nMissing/skipped metrics:")
    for m in missing_metrics:
        print(f"  - {m}")


# ── 1. KRUSKAL-WALLIS OMNIBUS FDR ─────────────────────────────────────────────

print("\nRunning Kruskal-Wallis omnibus tests...")

kruskal_rows = []

for metric in available_metrics:
    H, p = kruskal_for_metric(df, metric)

    family = "main_linguistic_metrics" if metric in MAIN_METRICS else "acronym_robustness_metrics"

    kruskal_rows.append({
        "metric": metric,
        "family": family,
        "H": H,
        "raw_p": p,
    })

kruskal_df = pd.DataFrame(kruskal_rows)

# FDR across all omnibus tests together
kruskal_df["fdr_p_all_omnibus"], kruskal_df["fdr_significant_all_omnibus"] = bh_fdr(
    kruskal_df["raw_p"].values
)

# FDR within main linguistic family
kruskal_df["fdr_p_within_family"] = np.nan
kruskal_df["fdr_significant_within_family"] = False

for family in kruskal_df["family"].unique():
    mask = kruskal_df["family"] == family
    adj, rej = bh_fdr(kruskal_df.loc[mask, "raw_p"].values)
    kruskal_df.loc[mask, "fdr_p_within_family"] = adj
    kruskal_df.loc[mask, "fdr_significant_within_family"] = rej

kruskal_path = os.path.join(OUTPUT_DIR, "fdr_kruskal_omnibus.csv")
kruskal_df.to_csv(kruskal_path, index=False)


# ── 2. DUNN PAIRWISE FDR ──────────────────────────────────────────────────────

print("Running Dunn pairwise tests...")

dunn_rows = []

for metric in available_metrics:
    dunn_rows.extend(dunn_for_metric(df, metric))

dunn_df = pd.DataFrame(dunn_rows)

if not dunn_df.empty:
    dunn_df["fdr_p_all_pairwise"], dunn_df["fdr_significant_all_pairwise"] = bh_fdr(
        dunn_df["raw_p"].values
    )

    dunn_df["fdr_p_within_metric"] = np.nan
    dunn_df["fdr_significant_within_metric"] = False

    for metric in dunn_df["metric"].unique():
        mask = dunn_df["metric"] == metric
        adj, rej = bh_fdr(dunn_df.loc[mask, "raw_p"].values)
        dunn_df.loc[mask, "fdr_p_within_metric"] = adj
        dunn_df.loc[mask, "fdr_significant_within_metric"] = rej

dunn_path = os.path.join(OUTPUT_DIR, "fdr_dunn_pairwise.csv")
dunn_df.to_csv(dunn_path, index=False)


# ── 3. PARTIAL CORRELATION FDR ────────────────────────────────────────────────

print("Running partial correlations...")

partial_specs = []

for metric in available_metrics:
    if metric in [
        "fk_grade",
        "gunning_fog",
        "smog",
        "avg_sentence_length",
        "avg_syllables_per_word",
        "type_token_ratio",
        "mattr",
        "hedge_per_100",
        "causal_per_100",
        "sentiment_pos",
        "sentiment_neg",
        "sentiment_neu",
        "sentiment_compound",
        "acronym_density_per_100_words",
        "avg_syllables_per_word_without_acronyms",
        "avg_syllables_per_word_acronyms_normalized",
    ]:
        partial_specs.append((metric, [WORD_COUNT_COL]))

# Extra robustness partial correlation for original syllables controlling acronym density too
if "avg_syllables_per_word" in df.columns and "acronym_density_per_100_words" in df.columns:
    partial_specs.append(("avg_syllables_per_word", [WORD_COUNT_COL, "acronym_density_per_100_words"]))

partial_rows = []

for metric, covars in partial_specs:
    r, p = partial_corr_for_metric(df, metric, covars)

    partial_rows.append({
        "metric": metric,
        "covariates": " + ".join(covars),
        "partial_r": r,
        "raw_p": p,
    })

partial_df = pd.DataFrame(partial_rows)

if not partial_df.empty:
    partial_df["fdr_p_all_partial_corrs"], partial_df["fdr_significant_all_partial_corrs"] = bh_fdr(
        partial_df["raw_p"].values
    )

partial_path = os.path.join(OUTPUT_DIR, "fdr_partial_correlations.csv")
partial_df.to_csv(partial_path, index=False)


# ── 4. PRINT SUMMARY ──────────────────────────────────────────────────────────

print("\n" + "=" * 80)
print("KRUSKAL-WALLIS OMNIBUS FDR SUMMARY")
print("=" * 80)

display_cols = [
    "metric",
    "H",
    "raw_p",
    "fdr_p_all_omnibus",
    "fdr_significant_all_omnibus",
    "fdr_p_within_family",
    "fdr_significant_within_family",
]

print(
    kruskal_df[display_cols]
    .sort_values("raw_p")
    .round(6)
    .to_string(index=False)
)

print("\n" + "=" * 80)
print("DUNN PAIRWISE FDR SUMMARY")
print("=" * 80)

if dunn_df.empty:
    print("Dunn tests not available. scikit_posthocs may not be installed.")
else:
    print(
        dunn_df[
            [
                "metric",
                "pair",
                "raw_p",
                "fdr_p_all_pairwise",
                "fdr_significant_all_pairwise",
                "fdr_p_within_metric",
                "fdr_significant_within_metric",
            ]
        ]
        .sort_values(["metric", "pair"])
        .round(6)
        .to_string(index=False)
    )

print("\n" + "=" * 80)
print("PARTIAL CORRELATION FDR SUMMARY")
print("=" * 80)

if partial_df.empty:
    print("No partial correlations computed.")
else:
    print(
        partial_df[
            [
                "metric",
                "covariates",
                "partial_r",
                "raw_p",
                "fdr_p_all_partial_corrs",
                "fdr_significant_all_partial_corrs",
            ]
        ]
        .sort_values("raw_p")
        .round(6)
        .to_string(index=False)
    )


# ── 5. SHORT INTERPRETIVE SUMMARY FILE ────────────────────────────────────────

summary_path = os.path.join(OUTPUT_DIR, "fdr_summary.txt")

with open(summary_path, "w", encoding="utf-8") as f:
    f.write("FDR Correction Summary\n")
    f.write("======================\n\n")

    f.write("Kruskal-Wallis omnibus tests:\n")
    sig_omnibus = kruskal_df[kruskal_df["fdr_significant_all_omnibus"] == True]
    f.write(f"{len(sig_omnibus)}/{len(kruskal_df)} metrics survived BH-FDR across all omnibus tests.\n\n")

    f.write("Metrics surviving omnibus FDR:\n")
    for _, row in sig_omnibus.sort_values("raw_p").iterrows():
        f.write(
            f"- {row['metric']}: H={row['H']:.3f}, raw p={p_text(row['raw_p'])}, "
            f"FDR p={p_text(row['fdr_p_all_omnibus'])}\n"
        )

    f.write("\nPartial correlations:\n")
    if not partial_df.empty:
        sig_partial = partial_df[partial_df["fdr_significant_all_partial_corrs"] == True]
        f.write(f"{len(sig_partial)}/{len(partial_df)} partial correlations survived BH-FDR.\n\n")

        f.write("Partial correlations surviving FDR:\n")
        for _, row in sig_partial.sort_values("raw_p").iterrows():
            f.write(
                f"- {row['metric']} controlling {row['covariates']}: "
                f"r={row['partial_r']:.3f}, raw p={p_text(row['raw_p'])}, "
                f"FDR p={p_text(row['fdr_p_all_partial_corrs'])}\n"
            )

    f.write("\nDunn pairwise tests:\n")
    if not dunn_df.empty:
        sig_dunn = dunn_df[dunn_df["fdr_significant_all_pairwise"] == True]
        f.write(f"{len(sig_dunn)}/{len(dunn_df)} pairwise comparisons survived BH-FDR across all pairwise tests.\n")

print("\n" + "=" * 80)
print("FILES SAVED")
print("=" * 80)
print(f"Kruskal omnibus FDR:     {kruskal_path}")
print(f"Dunn pairwise FDR:       {dunn_path}")
print(f"Partial correlation FDR: {partial_path}")
print(f"Summary text file:       {summary_path}")

print("\nDone.")