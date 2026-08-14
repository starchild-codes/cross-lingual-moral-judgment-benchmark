# Limitations Checklist

## Current Data And Analysis Caveats

- MFT labels were produced by two independent human coders and finalized through human adjudication. Human inter-rater reliability was 96.2% raw agreement with Cohen's kappa = 0.948. These labels remain interpretive qualitative codes rather than objective ground truth.
- The final qualitative dataset covers 10 designated target scenarios (S01, S06, S11, S16, S21, S26, S28, S29, S30, S34), not all 50 scenarios.
- The original requested 7,500 rating-row expectation was arithmetically inconsistent with the final design; the actual final rating data contain 5000 rows: 50 scenarios x 25 conditions x 4 models.
- Gemini Pro is used as the reference model in reference-divergence analyses; it is not one of the three primary evaluated models for the main effect estimates.
- Language-compliance review covered 24 model-language samples, with 24 marked correct and 4 marked truncated.
- Possible qualitative truncation by simple terminal-punctuation heuristic: 67/1000 qualitative responses. This heuristic is conservative and should be interpreted alongside the manual language-compliance review.
- Qualitative generation used finite max-token limits: 260 for non-Gemini models and 900 for Gemini-family models, according to `lib/qualitative.ts`.
- Arabic Condition B/C scenario text and Arabic prompts are marked final with native-speaker sign-off on 2026-06-24 in the documentation/language metadata.
- Arabic is right-to-left; all downstream rendering and paper examples should preserve Unicode text direction and avoid manual reversal or script stripping.
- Rating outputs are integer-only 1-7 blameworthiness judgments; this simplifies parsing but limits nuance.
- Effects are paired within scenario/model where applicable; small slices such as per-language per-model effects use n=50, while foundation-broken subsets can be smaller.
- Some old documentation still refers to earlier expected API volume and undecided qualitative subsample choices; the final data supersede those notes.

## Sample Sizes To Report

| quantity |n |
| --- | --- |
| rating rows per scenario/model across all 25 conditions | 25 |
| rating rows per scenario across 4 models | 100 |
| ratings per language/model effect estimate | 50 |
| qualitative rows per designated qualitative scenario across 25 conditions x 4 models | 100 |
| qualitative target scenarios | 10 |

## Historical/Open Items Found In Documentation

- Earlier README/PROJECT_SPEC notes recorded preliminary workflow decisions; the final workflow used two independent human coders plus human adjudication over 1,000 qualitative rows.
- Historical files and fields containing `ai_mft`, `llama`, or `deepseek` in their names are retained for traceability. Those names do not accurately describe the final human coding process and must not be used to infer AI-assisted or LLM-generated labels.
- PROJECT_SPEC warns language compliance cannot be perfectly verified automatically; the final language-compliance review is a sampled manual/Codex-assisted inspection, not an exhaustive proof.
- PROJECT_SPEC emphasizes UTF-8/non-Latin script validation and Arabic RTL handling; preserve this as a reproducibility caveat.

## Possibly Truncated Qualitative Rows Heuristic

The following table lists up to 25 rows whose raw output does not end in common sentence-final punctuation.

| response_id |model_key |scenario_id |condition_id |raw_output_tail |
| --- | --- | --- | --- | --- |
| full_1782215308316_vrq93w__claude__S16__hi_translation_reason_en__qualitative | claude | S16 | hi_translation_reason_en |  है, न कि निष्पक्ष नैतिक निर्णय। "मैं शायद चुनी जाती" यह अनुमान उन दो बेहतर आवेदकों के साथ हुए वास्तविक अन्याय को नहीं म |
| full_1782215308316_vrq93w__claude__S01__hi_translation_reason_hi__qualitative | claude | S01 | hi_translation_reason_hi | ### क्यों यह नैतिक रूप से गलत है:<br><br>यह कार्य इसलिए गलत है क्योंकि मीरा ने **जानबूझकर और बिना किसी को सूचित किए** एक ऐसी ज |
| full_1782215308316_vrq93w__claude__S06__hi_translation_reason_hi__qualitative | claude | S06 | hi_translation_reason_hi | ा। यह केवल विश्वासघात नहीं, बल्कि एक सुनियोजित नुकसान पहुँचाने की कोशिश है जिसने फ़ारुख़ के करियर को प्रभावित किया। इसलि |
| full_1782215308316_vrq93w__claude__S11__hi_translation_reason_hi__qualitative | claude | S11 | hi_translation_reason_hi |  घोषणा पिता के प्रति एक निजी ईमानदारी नहीं, बल्कि उनके सम्मान और भावनाओं की सार्वजनिक अनदेखी थी — जो उन व्यक्ति के साथ ह |
| full_1782215308316_vrq93w__claude__S16__hi_translation_reason_hi__qualitative | claude | S16 | hi_translation_reason_hi |  करना है।<br><br>यह कार्य नैतिक रूप से **आंशिक रूप से गलत** है, क्योंकि "मैं योग्य थी" का तर्क इस तथ्य को नहीं मिटाता कि दोषपू |
| full_1782215308316_vrq93w__claude__S21__hi_translation_reason_hi__qualitative | claude | S21 | hi_translation_reason_hi | न है, बल्कि श्रद्धालुओं की निजता और उनके पवित्र अनुभव का भी उल्लंघन है। रोहन ने अपने व्यावसायिक हित (पोर्टफ़ोलियो) को दू |
| full_1782215308316_vrq93w__claude__S01__hi_adapted_reason_hi__qualitative | claude | S01 | hi_adapted_reason_hi |  कि विमला देवी के पास कोई विकल्प नहीं है, फिर भी उसने न तो किसी को सूचित किया, न कोई वैकल्पिक व्यवस्था की। दो साल की देख |
| full_1782215308316_vrq93w__claude__S06__hi_adapted_reason_hi__qualitative | claude | S06 | hi_adapted_reason_hi | ह विश्वासघात, मित्रता की नैतिक बाध्यता और ईमानदार प्रतिस्पर्धा — दोनों का उल्लंघन है। करुणा पूरी तरह दोषी है, क्योंकि उस |
| full_1782215308316_vrq93w__claude__S11__hi_adapted_reason_hi__qualitative | claude | S11 | hi_adapted_reason_hi | तरफ धोखे का खुलासा, दूसरी तरफ रिश्तेदारों के सामने बेइज्जती। आदित्य को यह सच्चाई पहले, एकांत में और सम्मानपूर्वक बतानी च |
| full_1782215308316_vrq93w__claude__S16__hi_adapted_reason_hi__qualitative | claude | S16 | hi_adapted_reason_hi |  संभावना** है, वास्तविकता नहीं; वास्तविकता यह है कि चयन एक भ्रष्ट प्रक्रिया से हुआ। छात्रवृत्ति रखकर वह उस अन्याय से लाभ |
| full_1782215308316_vrq93w__claude__S21__hi_adapted_reason_hi__qualitative | claude | S21 | hi_adapted_reason_hi | ं और उनके पवित्र अनुभव का अपमान है। इसके अतिरिक्त, महाआरती जैसे अत्यंत संवेदनशील धार्मिक अनुष्ठान के दौरान बिना सहमति के |
| full_1782215308316_vrq93w__claude__S01__bn_translation_reason_bn__qualitative | claude | S01 | bn_translation_reason_bn | , এবং মি. শর্মা সম্পূর্ণরূপে তার উপর নির্ভরশীল ছিলেন — এই বিষয়টি সে জানত। সামাজিক অনুষ্ঠানে যাওয়া তার অধিকার হলেও, **ক |
| full_1782215308316_vrq93w__claude__S06__bn_translation_reason_bn__qualitative | claude | S06 | bn_translation_reason_bn | র সবচেয়ে নিকৃষ্ট রূপ। ফারুখ যখন সেই তথ্য শেয়ার করেছিল, তখন একটি অলিখিত কিন্তু স্পষ্ট নৈতিক চুক্তি ছিল যে এটি গোপন থাকব |
| full_1782215308316_vrq93w__claude__S11__bn_translation_reason_bn__qualitative | claude | S11 | bn_translation_reason_bn | নুষেরা সবাই উপস্থিত — এটি কেবল অসততা নয়, বরং বাবাকে প্রকাশ্যে অপমানিত ও অসহায় করে তোলার শামিল। যে মানুষটি নিজের জীবনের |
| full_1782215308316_vrq93w__claude__S16__bn_translation_reason_bn__qualitative | claude | S16 | bn_translation_reason_bn | অঘোষিত প্রভাব দুজন অধিক যোগ্য প্রার্থীকে বঞ্চিত করেছে — এবং সেই অন্যায়টি সংশোধনের সুযোগ থাকা সত্ত্বেও সে নিষ্ক্রিয় থেক |
| full_1782215308316_vrq93w__claude__S21__bn_translation_reason_bn__qualitative | claude | S21 | bn_translation_reason_bn | উপাসনারত ভক্তদের পবিত্রতম মুহূর্তে তাদের ধর্মীয় স্বায়ত্তশাসন ও মর্যাদাকে অসম্মান করা। ব্যক্তিগত পোর্টফোলিওর জন্য বাণিজ |
| full_1782215308316_vrq93w__claude__S01__bn_adapted_reason_bn__qualitative | claude | S01 | bn_adapted_reason_bn | দায়িত্ব ও বিশ্বাসের সম্পর্ক** তৈরি করেছিল, যা হঠাৎ এবং কাউকে না জানিয়ে ভেঙে দেওয়া সেই বিশ্বাসের সরাসরি লঙ্ঘন। সে জানত |
| full_1782215308316_vrq93w__claude__S06__bn_adapted_reason_bn__qualitative | claude | S06 | bn_adapted_reason_bn |  ব্যক্তিগত সুবিধার জন্য ব্যবহার করা বিশ্বাসঘাতকতার সবচেয়ে নিকৃষ্ট রূপ। এটি কেবল বন্ধুত্বের নৈতিক দায়িত্ব লঙ্ঘন নয়, বর |
| full_1782215308316_vrq93w__claude__S11__bn_adapted_reason_bn__qualitative | claude | S11 | bn_adapted_reason_bn | সম্মানজনক অনুষ্ঠানে, বহু মানুষের সামনে, যেখানে বাবার কাছে প্রতিক্রিয়া দেখানোর কোনো সুযোগই ছিল না। এই প্রকাশ্য ঘোষণা বাব |
| full_1782215308316_vrq93w__claude__S16__bn_adapted_reason_bn__qualitative | claude | S16 | bn_adapted_reason_bn | ানে যে আরও যোগ্য প্রার্থীরা অন্যায়ভাবে বঞ্চিত হয়েছেন। "আমি হয়তো নিজের যোগ্যতায়ও পেতাম" — এই যুক্তিটি একটি **অনুমানভি |
| full_1782215308316_vrq93w__claude__S21__bn_adapted_reason_bn__qualitative | claude | S21 | bn_adapted_reason_bn | ার ও সীমানার প্রতি সরাসরি অসম্মান। ব্যক্তিগত পেশাদার স্বার্থ (পোর্টফোলিও তৈরি) কখনোই অন্যের ধর্মীয় আচার-অনুষ্ঠানের গোপন |
| full_1782215308316_vrq93w__claude__S06__ta_translation_reason_en__qualitative | claude | S06 | ta_translation_reason_en | ுத்துவது நம்பிக்கை துரோகம் மட்டுமல்ல, ஒரு நபரின் பாதிப்பை ஆயுதமாக மாற்றுவதும் ஆகும். இது நேர்மையற்ற போட்டி நடத்தை என்பதோ |
| full_1782215308316_vrq93w__claude__S16__ta_translation_reason_en__qualitative | claude | S16 | ta_translation_reason_en |  பெல்லோஷிப்பை தொடர்வது, ஒரு குறைபாடுள்ள செயல்முறையின் பலனை அனுபவிப்பதை ஏற்றுக்கொள்வதாகும். தனது விண்ணப்பம் தகுதியானது என |
| full_1782215308316_vrq93w__claude__S01__ta_translation_reason_ta__qualitative | claude | S01 | ta_translation_reason_ta |  ஒரு நம்பகமான உறவை உருவாக்கியிருந்தது. மாற்று ஏற்பாடு எதுவும் இல்லை என்று தெரிந்தும், யாரிடமும் சொல்லாமல் தன் பொறுப்பை க |
| full_1782215308316_vrq93w__claude__S06__ta_translation_reason_ta__qualitative | claude | S06 | ta_translation_reason_ta | யையும் நம்பகத்தன்மையையும் முற்றிலும் காட்டிக் கொடுக்கிறது. எனவே நாதியா இந்தச் செயலுக்கு முழு அளவில் குற்றஞ்சாட்டப்பட வேண |
