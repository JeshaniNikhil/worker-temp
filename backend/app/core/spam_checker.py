import re
import math
from collections import Counter
from typing import Dict, List, Optional, Tuple

# Production-oriented email content risk analyzer.
#
# IMPORTANT:
# - This is a CONTENT-RISK scorer, not an inbox-placement predictor.
# - It intentionally treats normal B2B words such as "supplier", "catalogue",
#   "pricing", and "price list" as low-risk unless context/intensity is high.
# - It returns the same core keys as the original implementation:
#   findings, score
# - It also returns detailed signals, category scores, and recommendations.

# ---------------------------------------------------------------------------
# Phrase dictionary
# severity: base risk contribution for one occurrence.
# category: used for contextual weighting.
# level: high / medium / low.
# alternatives: optional wording suggestions.
# ---------------------------------------------------------------------------

SPAM_DICTIONARY: Dict[str, Dict] = {
    # High-risk urgency / pressure
    "act now": {
        "severity": 22, "category": "urgency", "level": "high",
        "alternatives": ["when convenient", "when you have a moment"],
        "reason": "Creates strong artificial urgency."
    },
    "action required": {
        "severity": 18, "category": "urgency", "level": "high",
        "alternatives": ["please review", "attention requested"],
        "reason": "Can resemble a transactional or phishing-style subject."
    },
    "apply now": {
        "severity": 16, "category": "urgency", "level": "high",
        "alternatives": ["submit an application", "register your interest"],
        "reason": "Direct pressure to act."
    },
    "buy now": {
        "severity": 22, "category": "urgency", "level": "high",
        "alternatives": ["view our products", "explore our range"],
        "reason": "High-pressure purchase CTA."
    },
    "call now": {
        "severity": 14, "category": "urgency", "level": "medium",
        "alternatives": ["contact our team", "reach out to us"],
        "reason": "Direct-response sales language."
    },
    "click here": {
        "severity": 18, "category": "cta", "level": "high",
        "alternatives": ["view the details", "learn more"],
        "reason": "Generic link CTA commonly seen in bulk/phishing mail."
    },
    "do it today": {
        "severity": 17, "category": "urgency", "level": "high",
        "alternatives": ["when convenient", "when you are ready"],
        "reason": "Artificial time pressure."
    },
    "get it now": {
        "severity": 17, "category": "urgency", "level": "high",
        "alternatives": ["access the information", "view the material"],
        "reason": "Immediate-action sales language."
    },
    "limited time": {
        "severity": 20, "category": "scarcity", "level": "high",
        "alternatives": ["current promotion", "current offering"],
        "reason": "Artificial scarcity."
    },
    "order now": {
        "severity": 20, "category": "urgency", "level": "high",
        "alternatives": ["place an order", "review the range"],
        "reason": "Direct purchase pressure."
    },
    "urgent": {
        "severity": 16, "category": "urgency", "level": "medium",
        "alternatives": ["important update", "timely information"],
        "reason": "Can create artificial urgency in unsolicited mail."
    },
    "while supplies last": {
        "severity": 18, "category": "scarcity", "level": "high",
        "alternatives": ["subject to availability", "based on current stock"],
        "reason": "Scarcity-based sales language."
    },

    # Financial / promotional
    "$$$": {
        "severity": 24, "category": "financial", "level": "high",
        "alternatives": ["pricing", "commercial details"],
        "reason": "Excessive money symbols are common in spam."
    },
    "100% free": {
        "severity": 22, "category": "promotion", "level": "high",
        "alternatives": ["included at no additional cost"],
        "reason": "Strong promotional wording."
    },
    "bargain": {
        "severity": 7, "category": "promotion", "level": "low",
        "alternatives": ["good value", "cost-effective"],
        "reason": "Informal promotional wording."
    },
    "bonus": {
        "severity": 6, "category": "promotion", "level": "low",
        "alternatives": ["additional benefit", "added value"],
        "reason": "Promotional language; context matters."
    },
    "cash bonus": {
        "severity": 24, "category": "financial", "level": "high",
        "alternatives": ["financial benefit"],
        "reason": "Financial incentive language can resemble scam content."
    },
    "cheap": {
        "severity": 7, "category": "promotion", "level": "low",
        "alternatives": ["cost-effective", "reasonably priced"],
        "reason": "Strong price-oriented wording."
    },
    "clearance": {
        "severity": 8, "category": "promotion", "level": "low",
        "alternatives": ["inventory update", "catalogue refresh"],
        "reason": "Retail promotion language."
    },
    "credit card": {
        "severity": 18, "category": "financial", "level": "high",
        "alternatives": ["payment method"],
        "reason": "Sensitive payment language; context is important."
    },
    "double your": {
        "severity": 19, "category": "financial", "level": "high",
        "alternatives": ["increase", "improve"],
        "reason": "Can imply an exaggerated financial claim."
    },
    "earn $": {
        "severity": 24, "category": "financial", "level": "high",
        "alternatives": ["generate revenue"],
        "reason": "Get-rich-quick style wording."
    },
    "eliminate debt": {
        "severity": 22, "category": "financial", "level": "high",
        "alternatives": ["manage liabilities"],
        "reason": "Financial solicitation wording."
    },
    "free": {
        "severity": 5, "category": "promotion", "level": "low",
        "alternatives": ["included", "complimentary"],
        "reason": "Promotional word; legitimate contexts are common."
    },
    "guarantee": {
        "severity": 8, "category": "claims", "level": "low",
        "alternatives": ["commitment", "quality standard"],
        "reason": "Promotional guarantee language; context matters."
    },
    "hidden costs": {
        "severity": 12, "category": "financial", "level": "medium",
        "alternatives": ["additional charges", "pricing details"],
        "reason": "Financial framing frequently used in sales copy."
    },
    "make money": {
        "severity": 22, "category": "financial", "level": "high",
        "alternatives": ["generate revenue", "increase profitability"],
        "reason": "Get-rich-quick style wording."
    },
    "no credit check": {
        "severity": 25, "category": "financial", "level": "high",
        "alternatives": ["flexible financing"],
        "reason": "Strong lending/scam signal."
    },
    "risk free": {
        "severity": 17, "category": "claims", "level": "high",
        "alternatives": ["evaluation period", "trial period"],
        "reason": "Strong promotional promise."
    },
    "save big money": {
        "severity": 19, "category": "financial", "level": "high",
        "alternatives": ["reduce costs", "achieve cost savings"],
        "reason": "Hyperbolic financial claim."
    },

    # B2B: intentionally low-to-medium risk
    "latest collections": {
        "severity": 3, "category": "b2b", "level": "low",
        "alternatives": ["new collections", "recent additions"],
        "reason": "Normal product-marketing language; only mildly promotional."
    },
    "competitive pricing": {
        "severity": 3, "category": "b2b", "level": "low",
        "alternatives": ["market-aligned pricing", "commercial pricing"],
        "reason": "Common legitimate B2B sales wording."
    },
    "special rates": {
        "severity": 5, "category": "b2b", "level": "low",
        "alternatives": ["tailored pricing", "volume pricing"],
        "reason": "Moderate promotional language."
    },
    "best available quotation": {
        "severity": 5, "category": "b2b", "level": "low",
        "alternatives": ["quotation", "project estimate"],
        "reason": "Commercial language; usually legitimate in B2B."
    },
    "reliable supplier": {
        "severity": 2, "category": "b2b", "level": "low",
        "alternatives": ["established supplier", "experienced manufacturer"],
        "reason": "Normal B2B sourcing terminology."
    },
    "compare our products": {
        "severity": 3, "category": "b2b", "level": "low",
        "alternatives": ["review our products", "evaluate our range"],
        "reason": "Normal competitive-sales language."
    },
    "compare pricing": {
        "severity": 3, "category": "b2b", "level": "low",
        "alternatives": ["review pricing", "discuss commercial terms"],
        "reason": "Normal B2B purchasing language."
    },
    "customized requirements": {
        "severity": 2, "category": "b2b", "level": "low",
        "alternatives": ["specific requirements", "project requirements"],
        "reason": "Normal B2B language."
    },
    "sample availability": {
        "severity": 2, "category": "b2b", "level": "low",
        "alternatives": ["sample options", "sample information"],
        "reason": "Normal product-sales language."
    },
    "price list": {
        "severity": 2, "category": "b2b", "level": "low",
        "alternatives": ["pricing details", "commercial terms"],
        "reason": "Normal B2B purchasing terminology."
    },

    # Scam / phishing-style phrases
    "dear friend": {
        "severity": 25, "category": "scam", "level": "high",
        "alternatives": ["hello", "hi {{First Name}}"],
        "reason": "Generic bulk-mail greeting."
    },
    "this isn't spam": {
        "severity": 30, "category": "scam", "level": "high",
        "alternatives": [""],
        "reason": "Explicitly denying spam is itself suspicious."
    },
    "winner": {
        "severity": 22, "category": "scam", "level": "high",
        "alternatives": ["recipient", "participant"],
        "reason": "Common prize/scam terminology."
    },
    "won": {
        "severity": 20, "category": "scam", "level": "high",
        "alternatives": ["received", "was selected"],
        "reason": "Prize/lottery-style language."
    },
    "you have been selected": {
        "severity": 21, "category": "scam", "level": "high",
        "alternatives": ["we are reaching out to you", "we would like to connect"],
        "reason": "Common unsolicited bulk-mail pattern."
    },
    "exclusive offer": {
        "severity": 10, "category": "promotion", "level": "medium",
        "alternatives": ["current offering", "available collection"],
        "reason": "Strong promotional wording."
    },
    "huge discount": {
        "severity": 18, "category": "promotion", "level": "high",
        "alternatives": ["volume discount", "quantity-based pricing"],
        "reason": "Aggressive promotional claim."
    },
    "best price": {
        "severity": 9, "category": "promotion", "level": "medium",
        "alternatives": ["quoted price", "available pricing"],
        "reason": "Absolute price claim."
    },
    "special offer": {
        "severity": 8, "category": "promotion", "level": "medium",
        "alternatives": ["current offering", "commercial proposal"],
        "reason": "Promotional sales phrase."
    },
    "limited offer": {
        "severity": 16, "category": "scarcity", "level": "high",
        "alternatives": ["current offering"],
        "reason": "Scarcity-based promotional language."
    },
}

# ---------------------------------------------------------------------------
# Contextual rules
# ---------------------------------------------------------------------------

STRONG_URGENCY = {
    "act now", "buy now", "order now", "limited time", "limited offer",
    "do it today", "get it now", "while supplies last", "this isn't spam",
    "you have been selected", "no credit check", "cash bonus"
}

PROMOTIONAL_TERMS = {
    "offer", "discount", "deal", "promotion", "special", "exclusive",
    "free", "bonus", "save", "best price", "lowest price", "huge",
    "guaranteed", "guarantee"
}

B2B_NORMAL_TERMS = {
    "supplier", "manufacturer", "distributor", "importer", "exporter",
    "catalogue", "catalog", "quotation", "quote", "pricing", "price list",
    "specifications", "packing", "tiles", "sanitaryware", "bulk order",
    "project", "wholesaler", "retailer", "collection", "shipment"
}

CTA_TERMS = {
    "click here", "buy now", "order now", "act now", "call now",
    "reply now", "get started", "sign up", "register now", "claim now",
    "download now", "contact us", "reply to this email"
}

def _normalize(text: str) -> str:
    text = text or ""
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()

def _phrase_pattern(phrase: str) -> re.Pattern:
    # Lookarounds work better than \b for phrases containing punctuation.
    escaped = re.escape(phrase.lower())
    return re.compile(r"(?<!\w)" + escaped + r"(?!\w)", re.IGNORECASE)

def _count_words(text: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", text, flags=re.UNICODE))

def _count_matches(text: str, phrase: str) -> List[re.Match]:
    return list(_phrase_pattern(phrase).finditer(text))

def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))

def _round_score(value: float) -> int:
    return int(round(_clamp(value)))

def _findings_for_dictionary(text: str) -> List[Dict]:
    findings = []

    for phrase, details in SPAM_DICTIONARY.items():
        for match in _count_matches(text, phrase):
            findings.append({
                "word": match.group(0),
                "start": match.start(),
                "end": match.end(),
                "alternatives": details.get("alternatives", []),
                "reason": details["reason"],
                "severity": details["severity"],
                "category": details["category"],
                "level": details["level"],
                "occurrence_penalty": details["severity"],
            })

    findings.sort(key=lambda item: item["start"])
    return findings

def _punctuation_signals(original: str) -> Tuple[float, Dict]:
    words = max(_count_words(original), 1)
    exclamations = len(re.findall(r"!+", original))
    questions = len(re.findall(r"\?+", original))
    dollar_runs = len(re.findall(r"\${2,}", original))
    emoji_like = len(re.findall(
        r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", original
    ))

    # Penalize density, not a single normal punctuation mark.
    exclamation_density = exclamations / words
    emoji_density = emoji_like / words

    penalty = 0.0
    if exclamations >= 3:
        penalty += min(8.0, 2.0 + exclamation_density * 120)
    if questions >= 4:
        penalty += min(3.0, questions * 0.5)
    if dollar_runs:
        penalty += min(6.0, dollar_runs * 2.0)
    if emoji_like >= 4:
        penalty += min(5.0, emoji_density * 100)

    return penalty, {
        "exclamation_runs": exclamations,
        "question_runs": questions,
        "multiple_dollar_runs": dollar_runs,
        "emoji_count": emoji_like,
    }

def _capitalization_signal(original: str) -> Tuple[float, Dict]:
    alpha_chars = [c for c in original if c.isalpha()]
    if not alpha_chars:
        return 0.0, {"uppercase_ratio": 0.0, "uppercase_words": 0}

    uppercase_ratio = sum(c.isupper() for c in alpha_chars) / len(alpha_chars)
    uppercase_words = len(re.findall(
        r"\b[A-Z]{3,}\b", original
    ))

    penalty = 0.0
    if uppercase_ratio >= 0.35:
        penalty += min(7.0, (uppercase_ratio - 0.35) * 20 + 2)
    if uppercase_words >= 3:
        penalty += min(7.0, uppercase_words * 0.8)

    return penalty, {
        "uppercase_ratio": round(uppercase_ratio, 3),
        "uppercase_words": uppercase_words,
    }

def _url_signal(original: str) -> Tuple[float, Dict]:
    urls = re.findall(
        r"(?:https?://|www\.)[^\s<>()]+",
        original,
        flags=re.IGNORECASE
    )

    suspicious_anchor_count = len(re.findall(
        r"(?:click here|buy now|claim now|download now)",
        original,
        flags=re.IGNORECASE
    ))

    penalty = 0.0
    if len(urls) >= 3:
        penalty += min(6.0, (len(urls) - 2) * 1.5)
    if suspicious_anchor_count:
        penalty += min(6.0, suspicious_anchor_count * 2.0)

    return penalty, {
        "url_count": len(urls),
        "suspicious_cta_count": suspicious_anchor_count,
    }

def _subject_signal(subject: str) -> Tuple[float, Dict]:
    if not subject:
        return 0.0, {"subject_phrase_hits": 0, "subject_caps": False}

    normalized = _normalize(subject)
    phrase_hits = 0

    for phrase in SPAM_DICTIONARY:
        if _count_matches(normalized, phrase):
            phrase_hits += 1

    caps = bool(re.search(r"\b[A-Z]{4,}\b", subject))
    exclamations = len(re.findall(r"!+", subject))

    penalty = 0.0
    if phrase_hits:
        penalty += min(10.0, phrase_hits * 3.0)
    if caps:
        penalty += 3.0
    if exclamations >= 2:
        penalty += 3.0

    return penalty, {
        "subject_phrase_hits": phrase_hits,
        "subject_caps": caps,
        "subject_exclamations": exclamations,
    }

def _density_signal(text: str, findings: List[Dict]) -> Tuple[float, Dict]:
    words = max(_count_words(text), 1)

    # Count unique risky phrases separately from occurrences.
    unique_phrases = len({f["word"].lower() for f in findings})
    total_hits = len(findings)
    risk_hits_per_100 = total_hits / words * 100

    # Low-risk B2B phrases should barely affect density.
    meaningful_hits = sum(
        1 for f in findings
        if f["level"] in {"medium", "high"}
    )
    meaningful_density = meaningful_hits / words * 100

    penalty = 0.0

    if meaningful_density > 1.0:
        penalty += min(10.0, (meaningful_density - 1.0) * 3.0)

    if unique_phrases >= 5:
        penalty += min(6.0, (unique_phrases - 4) * 1.0)

    if total_hits >= 8 and words < 180:
        penalty += min(7.0, (total_hits - 7) * 0.8)

    return penalty, {
        "word_count": words,
        "total_phrase_hits": total_hits,
        "unique_risky_phrases": unique_phrases,
        "risky_hits_per_100_words": round(risk_hits_per_100, 2),
        "medium_high_hits_per_100_words": round(meaningful_density, 2),
    }

def _category_scores(findings: List[Dict]) -> Dict[str, float]:
    categories = Counter()

    for finding in findings:
        # Diminishing returns: first occurrence matters most.
        category = finding["category"]
        categories[category] += finding["severity"]

    return {
        category: round(min(100.0, value), 2)
        for category, value in categories.items()
    }

def _context_adjustment(text: str, findings: List[Dict]) -> Tuple[float, List[str]]:
    """
    Reduces false positives in legitimate B2B emails and increases risk
    when multiple strong promotional patterns occur together.
    """
    adjustment = 0.0
    notes = []

    b2b_hits = sum(
        1 for term in B2B_NORMAL_TERMS
        if _count_matches(text, term)
    )

    strong_hits = sum(
        1 for finding in findings
        if finding["word"].lower() in STRONG_URGENCY
        or finding["level"] == "high"
    )

    promo_hits = sum(
        1 for term in PROMOTIONAL_TERMS
        if _count_matches(text, term)
    )

    cta_hits = sum(
        1 for term in CTA_TERMS
        if _count_matches(text, term)
    )

    # Legitimate B2B context: soften low-level commercial phrases.
    if b2b_hits >= 4 and strong_hits == 0:
        adjustment -= 8.0
        notes.append("Strong legitimate B2B context detected; commercial terms discounted.")

    # Multiple strong sales signals together are more concerning.
    if strong_hits >= 2:
        adjustment += min(12.0, (strong_hits - 1) * 4.0)
        notes.append("Multiple high-risk promotional/urgency signals occur together.")

    if promo_hits >= 4:
        adjustment += min(8.0, (promo_hits - 3) * 2.5)
        notes.append("High promotional-term concentration detected.")

    if cta_hits >= 2:
        adjustment += 4.0
        notes.append("Multiple direct-response CTAs detected.")

    return adjustment, notes

def _classify(score: int) -> str:
    # score = content quality/safety score, where higher is better.
    if score >= 90:
        return "very_low_risk"
    if score >= 75:
        return "low_risk"
    if score >= 55:
        return "moderate_risk"
    if score >= 35:
        return "high_risk"
    return "very_high_risk"

def analyze_content(
    text: str,
    subject: Optional[str] = None,
    html: Optional[str] = None,
) -> dict:
    """
    Analyze email content for spam-like wording and structural signals.

    Score:
        0   = very high content risk
        100 = very low content risk

    This score is NOT an inbox-placement probability.

    Compatible core output:
        findings: list
        score: int

    Additional output:
        risk_level
        summary
        category_scores
        signals
        recommendations
    """
    if not text or not str(text).strip():
        return {
            "findings": [],
            "score": 0,
            "risk_level": "very_high_risk",
            "summary": "No email content was provided.",
            "category_scores": {},
            "signals": {},
            "recommendations": ["Provide email content for analysis."],
        }

    original = str(text)
    normalized = _normalize(original)

    findings = _findings_for_dictionary(normalized)

    # Diminishing returns for repeated identical phrases.
    # First occurrence gets 100%, second 45%, subsequent 20%.
    raw_phrase_penalty = 0.0
    seen = Counter()

    for finding in findings:
        key = finding["word"].lower()
        seen[key] += 1

        occurrence = seen[key]
        if occurrence == 1:
            multiplier = 1.0
        elif occurrence == 2:
            multiplier = 0.45
        else:
            multiplier = 0.20

        effective_penalty = finding["severity"] * multiplier
        finding["effective_penalty"] = round(effective_penalty, 2)
        raw_phrase_penalty += effective_penalty

    density_penalty, density = _density_signal(normalized, findings)
    punctuation_penalty, punctuation = _punctuation_signals(original)
    capitalization_penalty, capitalization = _capitalization_signal(original)
    url_penalty, urls = _url_signal(original)
    subject_penalty, subject_info = _subject_signal(subject or "")

    context_adjustment, context_notes = _context_adjustment(
        normalized, findings
    )

    # HTML is optional. We don't inspect the whole DOM, but flag unusually
    # link-heavy markup when supplied.
    html_penalty = 0.0
    html_info = {"html_links": 0, "html_length": len(html or "")}
    if html:
        html_links = len(re.findall(r"<a\b", html, flags=re.IGNORECASE))
        html_info["html_links"] = html_links
        if html_links >= 6:
            html_penalty = min(5.0, (html_links - 5) * 0.8)

    # Base score. Phrase penalty is intentionally bounded so one dictionary
    # match cannot destroy an otherwise normal email.
    phrase_penalty = min(45.0, raw_phrase_penalty)

    total_penalty = (
        phrase_penalty
        + min(12.0, density_penalty)
        + min(12.0, punctuation_penalty)
        + min(12.0, capitalization_penalty)
        + min(10.0, url_penalty)
        + min(10.0, subject_penalty)
        + min(5.0, html_penalty)
        + context_adjustment
    )

    score = _round_score(100.0 - total_penalty)
    risk_level = _classify(score)

    recommendations = []

    if any(f["level"] == "high" for f in findings):
        recommendations.append(
            "Review high-risk urgency, scarcity, financial, or scam-style phrases."
        )

    if punctuation_penalty >= 3:
        recommendations.append(
            "Reduce repeated exclamation marks, money symbols, or excessive emojis."
        )

    if capitalization_penalty >= 3:
        recommendations.append(
            "Avoid excessive ALL-CAPS wording; use normal sentence capitalization."
        )

    if density_penalty >= 3:
        recommendations.append(
            "Reduce the concentration of promotional phrases rather than removing every commercial term."
        )

    if subject_penalty >= 3:
        recommendations.append(
            "Keep the subject specific and natural; avoid pressure, ALL-CAPS, and repeated punctuation."
        )

    if url_penalty >= 3:
        recommendations.append(
            "Limit unnecessary URLs and avoid generic high-pressure link CTAs."
        )

    if not recommendations:
        recommendations.append(
            "Content has relatively low spam-like wording signals."
        )

    category_scores = _category_scores(findings)

    summary = (
        f"Content score: {score}/100 ({risk_level.replace('_', ' ')}). "
        f"Detected {len(findings)} phrase occurrence(s) across "
        f"{len({f['word'].lower() for f in findings})} unique phrase(s)."
    )

    signals = {
        "phrase_penalty": round(phrase_penalty, 2),
        "density_penalty": round(density_penalty, 2),
        "punctuation_penalty": round(punctuation_penalty, 2),
        "capitalization_penalty": round(capitalization_penalty, 2),
        "url_penalty": round(url_penalty, 2),
        "subject_penalty": round(subject_penalty, 2),
        "html_penalty": round(html_penalty, 2),
        "context_adjustment": round(context_adjustment, 2),
        **density,
        **punctuation,
        **capitalization,
        **urls,
        **subject_info,
        **html_info,
    }

    return {
        "findings": findings,
        "score": score,
        "risk_level": risk_level,
        "summary": summary,
        "category_scores": category_scores,
        "signals": signals,
        "context_notes": context_notes,
        "recommendations": recommendations,
    }


def analyze_email(
    subject: str,
    body: str,
    html: Optional[str] = None,
) -> dict:
    """Convenience wrapper for a complete email."""
    return analyze_content(body, subject=subject, html=html)


if __name__ == "__main__":
    # Small local smoke test.
    test_subject = "Porcelain Tile Supply – Catalogue & Pricing"
    test_body = """
    Dear Michael,

    I hope you're doing well.

    My name is David, and I'm an Export Sales Executive at Wolf Group India.
    We manufacture and export porcelain and vitrified tiles for importers,
    distributors, wholesalers, retailers, and project buyers.

    We can offer competitive pricing and special rates for suitable bulk
    requirements. I can share our latest catalogue, specifications, packing
    details, and price list for your review.

    Please let me know if you would like the information.

    Best regards,
    David
    """

    result = analyze_email(test_subject, test_body)

    print(result["summary"])
    print("Risk level:", result["risk_level"])
    print("Recommendations:")
    for recommendation in result["recommendations"]:
        print("-", recommendation)