/**
 * KotobaFlow — Japanese De-inflection Engine
 *
 * Implements rule-based de-inflection (khử chia động từ) modeled after
 * 10ten Japanese Reader / Rikaichamp. Converts inflected forms back to
 * dictionary forms so they can be looked up in JMDict.
 *
 * Rules cover:
 *  - て/た form (all godan consonant stems)
 *  - ている/てる progressive
 *  - ない negative
 *  - ます polite / ません / ました
 *  - られる/れる potential & passive
 *  - させる/せる causative
 *  - たい desiderative
 *  - ば conditional
 *  - Command / imperative forms
 *  - い-adjective inflections
 */

export interface Deinflection {
  /** The candidate dictionary-form string to look up */
  term: string;
  /** Human-readable description of the inflection detected */
  inflectionType: string;
  /** Rough part-of-speech hint for the candidate */
  pos: "verb" | "adj-i" | "any";
}

// ---------------------------------------------------------------------------
// Rule table
// Each rule: [inflectedSuffix, dictionaryReplacementSuffix, label, pos]
// ---------------------------------------------------------------------------
const RULES: [string, string, string, Deinflection["pos"]][] = [
  // ── て/た form — godan (Group 1) ──────────────────────────────────────────
  ["って",   "う",  "て-form (u→tte)",   "verb"],
  ["った",   "う",  "た-form (u→tta)",   "verb"],
  ["いて",   "く",  "て-form (ku→ite)",  "verb"],
  ["いた",   "く",  "た-form (ku→ita)",  "verb"],
  ["いで",   "ぐ",  "て-form (gu→ide)",  "verb"],
  ["いだ",   "ぐ",  "た-form (gu→ida)",  "verb"],
  ["して",   "す",  "て-form (su→shite)","verb"],
  ["した",   "す",  "た-form (su→shita)","verb"],
  ["って",   "つ",  "て-form (tsu→tte)", "verb"],
  ["った",   "つ",  "た-form (tsu→tta)", "verb"],
  ["んで",   "む",  "て-form (mu→nde)",  "verb"],
  ["んだ",   "む",  "た-form (mu→nda)",  "verb"],
  ["んで",   "ぶ",  "て-form (bu→nde)",  "verb"],
  ["んだ",   "ぶ",  "た-form (bu→nda)",  "verb"],
  ["んで",   "ぬ",  "て-form (nu→nde)",  "verb"],
  ["んだ",   "ぬ",  "た-form (nu→nda)",  "verb"],
  ["って",   "る",  "て-form (godan ru→tte)", "verb"],
  ["った",   "る",  "た-form (godan ru→tta)", "verb"],

  // ── て/た form — ichidan (Group 2) ───────────────────────────────────────
  ["て",     "る",  "て-form (ichidan)",  "verb"],
  ["た",     "る",  "た-form (ichidan)",  "verb"],

  // ── ている / でいる progressive ──────────────────────────────────────────
  ["んでいる", "む",  "progressive (mu)",  "verb"],
  ["んでいる", "ぶ",  "progressive (bu)",  "verb"],
  ["んでいる", "ぬ",  "progressive (nu)",  "verb"],
  ["んでる",   "む",  "progressive-cont (mu)", "verb"],
  ["んでる",   "ぶ",  "progressive-cont (bu)", "verb"],
  ["んでる",   "ぬ",  "progressive-cont (nu)", "verb"],
  ["ている",   "る",  "progressive",       "verb"],
  ["てる",     "る",  "progressive-cont",  "verb"],
  ["でいる",   "ぐ",  "progressive (gu)",  "verb"],
  ["でる",     "ぐ",  "progressive-cont (gu)", "verb"],

  // ── ない negative ────────────────────────────────────────────────────────
  ["わない",   "う",  "negative",          "verb"],
  ["かない",   "く",  "negative",          "verb"],
  ["がない",   "ぐ",  "negative",          "verb"],
  ["さない",   "す",  "negative",          "verb"],
  ["たない",   "つ",  "negative",          "verb"],
  ["まない",   "む",  "negative",          "verb"],
  ["ばない",   "ぶ",  "negative",          "verb"],
  ["なない",   "ぬ",  "negative",          "verb"],
  ["らない",   "る",  "negative (godan)",  "verb"],
  ["ない",     "る",  "negative (ichidan)","verb"],

  // ── ます polite ──────────────────────────────────────────────────────────
  ["います",   "う",  "masu",              "verb"],
  ["きます",   "く",  "masu",              "verb"],
  ["ぎます",   "ぐ",  "masu",              "verb"],
  ["します",   "す",  "masu",              "verb"],
  ["ちます",   "つ",  "masu",              "verb"],
  ["にます",   "ぬ",  "masu",              "verb"],
  ["びます",   "ぶ",  "masu",              "verb"],
  ["みます",   "む",  "masu",              "verb"],
  ["ります",   "る",  "masu",              "verb"],
  ["ます",     "る",  "masu (ichidan)",    "verb"],
  ["いません", "う",  "masu-negative",     "verb"],
  ["きません", "く",  "masu-negative",     "verb"],
  ["しません", "す",  "masu-negative",     "verb"],
  ["りません", "る",  "masu-negative",     "verb"],
  ["ません",   "る",  "masu-negative (ichidan)", "verb"],
  ["いました", "う",  "masu-past",         "verb"],
  ["きました", "く",  "masu-past",         "verb"],
  ["しました", "す",  "masu-past",         "verb"],
  ["りました", "る",  "masu-past",         "verb"],
  ["ました",   "る",  "masu-past (ichidan)","verb"],

  // ── たい desiderative ─────────────────────────────────────────────────────
  ["いたい",   "う",  "desiderative",      "verb"],
  ["きたい",   "く",  "desiderative",      "verb"],
  ["したい",   "す",  "desiderative",      "verb"],
  ["ちたい",   "つ",  "desiderative",      "verb"],
  ["みたい",   "む",  "desiderative",      "verb"],
  ["りたい",   "る",  "desiderative",      "verb"],
  ["たい",     "る",  "desiderative (ichidan)", "verb"],

  // ── られる potential / passive ────────────────────────────────────────────
  ["られる",   "る",  "potential/passive",  "verb"],
  ["れる",     "う",  "passive (u)",        "verb"],
  ["れる",     "く",  "passive (ku)",       "verb"],
  ["れる",     "す",  "passive (su)",       "verb"],
  ["れる",     "む",  "passive (mu)",       "verb"],
  ["れる",     "る",  "passive (godan ru)", "verb"],

  // ── させる causative ──────────────────────────────────────────────────────
  ["させる",   "する","causative (suru)",   "verb"],
  ["させる",   "る",  "causative (ichidan)","verb"],
  ["かせる",   "く",  "causative",          "verb"],
  ["ませる",   "む",  "causative",          "verb"],

  // ── ば conditional ────────────────────────────────────────────────────────
  ["えば",     "う",  "conditional",        "verb"],
  ["けば",     "く",  "conditional",        "verb"],
  ["せば",     "す",  "conditional",        "verb"],
  ["てば",     "つ",  "conditional",        "verb"],
  ["めば",     "む",  "conditional",        "verb"],
  ["べば",     "ぶ",  "conditional",        "verb"],
  ["れば",     "る",  "conditional",        "verb"],
  ["ければ",   "い",  "conditional (adj-i)","adj-i"],

  // ── Imperative ────────────────────────────────────────────────────────────
  ["え",       "う",  "imperative",         "verb"],
  ["け",       "く",  "imperative",         "verb"],
  ["せ",       "す",  "imperative",         "verb"],
  ["て",       "つ",  "imperative",         "verb"],
  ["め",       "む",  "imperative",         "verb"],
  ["べ",       "ぶ",  "imperative",         "verb"],
  ["ろ",       "る",  "imperative (ichidan)","verb"],

  // ── い-adjective ──────────────────────────────────────────────────────────
  ["くない",   "い",  "adj-i negative",     "adj-i"],
  ["くて",     "い",  "adj-i te-form",      "adj-i"],
  ["かった",   "い",  "adj-i past",         "adj-i"],
  ["くなかった","い",  "adj-i past-neg",     "adj-i"],
  ["く",       "い",  "adj-i adverb",       "adj-i"],

  // ── Special / irregular ───────────────────────────────────────────────────
  ["して",     "する","suru te-form",       "verb"],
  ["した",     "する","suru past",          "verb"],
  ["しない",   "する","suru negative",      "verb"],
  ["します",   "する","suru masu",          "verb"],
  ["できる",   "する","potential of suru",  "verb"],
  ["きて",     "くる","kuru te-form",       "verb"],
  ["きた",     "くる","kuru past",          "verb"],
  ["こない",   "くる","kuru negative",      "verb"],
];

// Sort rules longest-first so more specific rules match before shorter ones
RULES.sort((a, b) => b[0].length - a[0].length);

/**
 * Given an inflected string, return all possible dictionary-form candidates
 * by applying every matching de-inflection rule.
 *
 * Example:
 *   deinflect("食べてる") →
 *   [
 *     { term: "食べてる", inflectionType: "original", pos: "any" },
 *     { term: "食べる",   inflectionType: "progressive-cont", pos: "verb" },
 *   ]
 */
export function deinflect(text: string): Deinflection[] {
  const results: Deinflection[] = [
    { term: text, inflectionType: "original", pos: "any" },
  ];

  const seen = new Set<string>([text]);

  for (const [suffix, replacement, label, pos] of RULES) {
    if (text.endsWith(suffix)) {
      const stem = text.slice(0, text.length - suffix.length);
      const candidate = stem + replacement;

      // Minimum length guard (avoid single-char nonsense)
      if (candidate.length >= 2 && !seen.has(candidate)) {
        seen.add(candidate);
        results.push({ term: candidate, inflectionType: label, pos });
      }
    }
  }

  return results;
}
