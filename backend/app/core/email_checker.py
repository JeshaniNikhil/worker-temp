import re
import os
import dns.resolver
import socket
import smtplib
import random
import string
import time
import logging
import unicodedata
from datetime import datetime
from typing import Tuple, Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config: Bind outbound SMTP to static IP on VPS (set SMTP_SOURCE_IP env var)
# On Contabo VPS: export SMTP_SOURCE_IP=169.58.234.98
# Locally: leave unset (empty string = OS picks interface)
# ---------------------------------------------------------------------------
SMTP_SOURCE_IP = os.environ.get("SMTP_SOURCE_IP", "").strip()
SMTP_VERIFICATION_FROM = os.environ.get("SMTP_VERIFICATION_FROM", "verify@validator.wolfgroupindia.com").strip()
SMTP_HELO_HOST = os.environ.get("SMTP_HELO_HOST", "validator.wolfgroupindia.com").strip()

# ---------------------------------------------------------------------------
# Reference lists
# ---------------------------------------------------------------------------

DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com",
    "yopmail.com", "dropmail.me", "temp-mail.org", "trashmail.com",
    "throwam.com", "fakeinbox.com", "maildrop.cc", "getnada.com",
    "spamgourmet.com", "sharklasers.com", "guerrillamailblock.com",
    "grr.la", "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de",
    "guerrillamail.net", "guerrillamail.org", "spam4.me", "trashmail.at",
    "trashmail.io", "trashmail.me", "trashmail.net", "trashmail.xyz",
    "dispostable.com", "mailnull.com", "spamspot.com", "spamthisplease.com",
    "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org", "mail-temporaire.fr",
    "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj",
    "speed.1s.fr", "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf",
    "monmail.fr.nf", "mailmetrash.com", "trashdevil.com", "trashdevil.de",
    "trashmail.com", "mailscrap.com", "fiifke.de", "despam.it",
    "mintemail.com", "filzmail.com", "gelöscht.de", "pookmail.com",
    "spaml.de", "throwam.com", "safetymail.info", "mailnew.com",
    "binkmail.com", "bobmail.info", "chammy.info", "devnullmail.com",
    "dieseis.de", "emailias.com", "emkei.cz", "emkei.gq",
    "harakirimail.com", "imails.info", "inoutmail.de", "inoutmail.eu",
    "inoutmail.info", "inoutmail.net", "jetable.com", "jetable.de",
    "jetable.net", "jetable.org", "kasmail.com", "kaspop.com",
    "killmail.com", "killmail.net", "klassmaster.com", "link2mail.net",
    "litedrop.com", "lol.ovpn.to", "lookugly.com", "lortemail.dk",
    "m21.cc", "mail.by", "mailbidon.com", "mailbiz.biz", "mailblocks.com",
    "mailbucket.org", "mailcat.biz", "mailcatch.com", "mailde.de",
    "mailde.info", "mailexpire.com", "mailfreeonline.com", "mailguard.me",
    "mailimate.com", "mailmate.com", "mailme.lv", "mailnew.com",
    "mailproxsy.com", "mailquack.com", "mailsiphon.com", "mailslink.net",
    "mailsucker.net", "mailzilla.com", "meltmail.com", "mierdamail.com",
    "migumail.com", "mintemail.com", "moncourrier.fr.nf", "monemail.fr.nf",
    "monmail.fr.nf", "mt2009.com", "mt2014.com", "mypartyclip.de",
    "myphantomemail.com", "mysamp.de", "mytrashmail.com", "netmails.net",
    "nwldx.com", "odmail.com", "oneoffemail.com", "onewaymail.com",
    "otherinbox.coieanmse.com", "ovpn.to", "owlpic.com", "pimpedupmyspace.com",
    "prtnx.com", "rcpt.at", "reallymymail.com", "recode.me", "recursor.net",
    "reliable-mail.com", "rklips.com", "rppkn.com", "rtrtr.com", "s0ny.net",
    "safe-mail.net", "safetymail.info", "safetypost.de", "sandelf.de",
    "selfdestructingmail.com", "sendspamhere.com", "sharklasers.com",
    "shieldedmail.com", "shitmail.de", "shitmail.me", "shortmail.net",
    "sibmail.com", "skeefmail.com", "smellfear.com", "snakemail.com",
    "sneakemail.com", "sneakmail.de", "snkmail.com", "sofimail.com",
    "sogetthis.com", "soodonims.com", "spam.la", "spam.su", "spam4.me",
    "spamavert.com", "spambob.com", "spambob.net", "spambob.org",
    "spamcannon.com", "spamcannon.net", "spamcero.com", "spamcon.org",
    "spamcorptastic.com", "spamcowboy.com", "spamcowboy.net", "spamcowboy.org",
    "spamday.com", "spamex.com", "spamfree.eu", "spamfree24.de",
    "spamfree24.eu", "spamfree24.info", "spamfree24.net", "spamfree24.org",
    "spamgob.com", "spamgoes.in", "spamgourmet.com", "spamgourmet.net",
    "spamgourmet.org", "spamherelots.com", "spamhereplease.com",
    "spamhole.com", "spamify.com", "spaminator.de", "spamkill.info",
    "spaml.com", "spaml.de", "spamlot.net", "spammotel.com",
    "spammy.host", "spamoff.de", "spamspot.com", "spamstack.net",
    "spamthisplease.com", "spamtrail.com", "spamtrap.ro", "speed.1s.fr",
    "tafmail.com", "tagyourself.com", "teewars.org", "teleworm.com",
    "teleworm.us", "tempalias.com", "tempinbox.co.uk", "tempinbox.com",
    "tempomail.fr", "temporaryemail.net", "temporaryemail.us",
    "temporaryforwarding.com", "temporaryinbox.com", "thanksnospam.info",
    "thisisnotmyrealemail.com", "throwam.com", "throwamailboxaway.com",
    "tilien.com", "tittbit.in", "tmailinator.com", "toiea.com",
    "tradermail.info", "trash-amil.com", "trash-mail.at", "trash-mail.cf",
    "trash-mail.ga", "trash-mail.gq", "trash-mail.io", "trash-mail.ml",
    "trash-mail.tk", "trashemails.de", "trashimail.com", "trashmail.app",
    "trashmail.at", "trashmail.ax", "trashmail.com", "trashmail.io",
    "trashmail.me", "trashmail.net", "trashmail.se", "trashmail.xyz",
    "treinamento.de", "trmailbox.com", "turual.com", "tyldd.com",
    "ubm.md", "uggsrock.com", "uroid.com", "venompen.com",
    "viditag.com", "vomoto.com", "vubby.com", "w3internet.co.uk",
    "walala.org", "wasila.com", "wasteland.rr.nu", "watchfull.net",
    "webemail.me", "weg-werf-email.de", "wegwerfadresse.de",
    "wegwerfemail.com", "wegwerfemail.de", "wegwerfemail.info",
    "wegwerfemail.net", "wegwerfemail.org", "wegwerfmail.de",
    "wegwerfmail.info", "wegwerfmail.net", "wegwerfmail.org",
    "wh4f.org", "whyspam.me", "willhackforfood.biz", "willselfdestruct.com",
    "winemaven.info", "wronghead.com", "wuzupmail.net", "xagloo.com",
    "xemaps.com", "xents.com", "xmaily.com", "xoxy.net", "xyzfree.net",
    "yep.it", "yogamaven.com", "yopmail.com", "yopmail.fr", "youmail.dk",
    "yourdomain.com", "yuurok.com", "z0d.eu", "zebins.com", "zebins.eu",
    "zehnminutenmail.de", "zetmail.com", "zippymail.info", "zoemail.net",
    "zoemail.org", "zomg.info",
}

FREE_EMAIL_PROVIDERS = {
    "gmail.com", "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "yahoo.com.au",
    "hotmail.com", "hotmail.co.uk", "hotmail.fr", "outlook.com", "outlook.in",
    "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
    "protonmail.com", "proton.me", "tutanota.com", "zoho.com", "zohomail.com",
    "mail.com", "gmx.com", "gmx.us", "gmx.net", "gmx.de",
    "rediffmail.com", "yandex.com", "yandex.ru",
    "inbox.com", "fastmail.com", "fastmail.fm", "hushmail.com",
    "rocketmail.com", "lavabit.com", "safe-mail.net",
}

ROLE_ACCOUNTS = {
    "info", "support", "admin", "administrator", "sales", "marketing",
    "contact", "hello", "help", "service", "noreply", "no-reply", "noreply",
    "donotreply", "do-not-reply", "webmaster", "postmaster", "hostmaster",
    "abuse", "security", "privacy", "legal", "billing", "accounts",
    "office", "team", "mail", "email", "enquiries", "enquiry",
    "jobs", "careers", "press", "media", "news", "newsletter",
    "subscribe", "unsubscribe", "feedback", "mailer", "mailer-daemon",
    "root", "sys", "system", "dev", "developer", "it", "ops",
    "network", "hr", "finance", "accounting", "compliance",
    "spam", "junk", "report", "bot", "auto", "autoresponder",
    "notifications", "notify", "alerts", "alert", "updates",
    "register", "registration", "signup", "login", "user", "users",
}

COMMON_EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
    "aol.com", "icloud.com", "mail.com", "gmx.com", "protonmail.com",
    "zoho.com", "yandex.com", "fastmail.com", "msn.com", "me.com",
    "rocketmail.com", "rediffmail.com", "inbox.com", "tutanota.com",
]

# ---------------------------------------------------------------------------
# DNS Resolver (no Port 25 needed)
# ---------------------------------------------------------------------------
resolver = dns.resolver.Resolver()
resolver.timeout = 3.0
resolver.lifetime = 5.0


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def levenshtein_distance(s1: str, s2: str) -> int:
    """Compute edit distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]


def normalize_email(email: str) -> str:
    """Normalize email: strip whitespace, lowercase, handle unicode domains."""
    email = email.strip().lower()
    try:
        local, domain = email.rsplit("@", 1)
        # Encode international domain to ASCII punycode
        try:
            domain_ascii = domain.encode("idna").decode("ascii")
        except (UnicodeError, UnicodeDecodeError):
            domain_ascii = domain
        email = f"{local}@{domain_ascii}"
    except ValueError:
        pass
    return email


def _make_check(name: str, status: str, detail: str, category: str = "") -> Dict[str, Any]:
    return {
        "name": name,
        "status": status,   # PASS | FAIL | WARNING | INFO | SKIP
        "detail": detail,
        "category": category,
    }


# ---------------------------------------------------------------------------
# Individual check functions
# ---------------------------------------------------------------------------

def check_syntax(email: str) -> Dict[str, Any]:
    # RFC 5321-compliant: local part allows letters, digits, and .!#$%&'*+/=?^_`{|}~-
    # Domain must have at least one dot and a valid TLD (2+ chars)
    pattern = r"^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.\-]+@[a-zA-Z0-9\-]+(\.[a-zA-Z0-9\-]+)*\.[a-zA-Z]{2,}$"
    if not email or "@" not in email:
        return _make_check("Syntax", "FAIL", f"'{email}' is missing the '@' symbol.", "format")
    local, _, domain = email.partition("@")
    if not local:
        return _make_check("Syntax", "FAIL", "Local part (before @) is empty.", "format")
    if not domain or "." not in domain:
        return _make_check("Syntax", "FAIL", f"Domain '{domain}' is missing or has no TLD.", "format")
    if ".." in email:
        return _make_check("Syntax", "FAIL", "Email contains consecutive dots '..' which is invalid.", "format")
    if re.match(pattern, email):
        return _make_check("Syntax", "PASS", f"'{email}' is a valid email format.", "format")
    return _make_check("Syntax", "FAIL", f"'{email}' is not a valid email format. Expected: name@domain.com", "format")


def check_domain_existence(domain: str) -> Tuple[Dict[str, Any], bool]:
    """Returns (check_result, domain_exists)."""
    try:
        # Try A record first
        resolver.resolve(domain, "A")
        return _make_check("Domain Existence", "PASS", f"Domain '{domain}' resolves successfully.", "dns"), True
    except dns.resolver.NXDOMAIN:
        return _make_check("Domain Existence", "FAIL", f"Domain '{domain}' does not exist (NXDOMAIN).", "dns"), False
    except dns.exception.Timeout:
        return _make_check("Domain Existence", "WARNING", f"DNS lookup timed out for '{domain}'.", "dns"), False
    except Exception:
        try:
            resolver.resolve(domain, "MX")
            return _make_check("Domain Existence", "PASS", f"Domain '{domain}' has MX records (resolves via MX).", "dns"), True
        except Exception:
            return _make_check("Domain Existence", "WARNING", f"Could not verify domain '{domain}'.", "dns"), False


def check_mx_record(domain: str) -> Tuple[Dict[str, Any], List[str]]:
    """Returns (check_result, mx_list)."""
    try:
        answers = resolver.resolve(domain, "MX")
        records = sorted(answers, key=lambda r: r.preference)
        mx_list = [str(r.exchange).rstrip(".") for r in records]
        return _make_check(
            "MX Record", "PASS",
            f"Found {len(mx_list)} mail server(s): {', '.join(mx_list[:3])}", "dns"
        ), mx_list
    except dns.resolver.NXDOMAIN:
        return _make_check("MX Record", "FAIL", f"No MX records found — domain cannot receive email.", "dns"), []
    except dns.resolver.NoAnswer:
        return _make_check("MX Record", "WARNING", f"No MX records; domain may fall back to A record.", "dns"), []
    except dns.exception.Timeout:
        return _make_check("MX Record", "WARNING", "MX DNS lookup timed out.", "dns"), []
    except Exception as e:
        return _make_check("MX Record", "WARNING", f"Could not look up MX records: {e}", "dns"), []


def check_a_record(domain: str) -> Dict[str, Any]:
    try:
        answers = resolver.resolve(domain, "A")
        ips = [str(r) for r in answers]
        return _make_check("A Record", "PASS", f"Domain resolves to IP: {', '.join(ips[:3])}", "dns")
    except dns.resolver.NXDOMAIN:
        return _make_check("A Record", "FAIL", f"Domain '{domain}' has no A record.", "dns")
    except dns.resolver.NoAnswer:
        return _make_check("A Record", "INFO", "No A record; domain may be MX-only.", "dns")
    except dns.exception.Timeout:
        return _make_check("A Record", "WARNING", "A record DNS lookup timed out.", "dns")
    except Exception as e:
        return _make_check("A Record", "WARNING", f"A record lookup failed: {e}", "dns")


def check_disposable(domain: str) -> Dict[str, Any]:
    if domain in DISPOSABLE_DOMAINS:
        return _make_check("Disposable Domain", "FAIL",
                           f"'{domain}' is a known temporary/disposable email provider.", "reputation")
    return _make_check("Disposable Domain", "PASS",
                       f"'{domain}' is not a known disposable email provider.", "reputation")


def check_free_provider(domain: str) -> Dict[str, Any]:
    if domain in FREE_EMAIL_PROVIDERS:
        return _make_check("Free Email Provider", "WARNING",
                           f"'{domain}' is a free consumer email provider (e.g., Gmail, Yahoo).", "reputation")
    return _make_check("Free Email Provider", "PASS",
                       f"'{domain}' appears to be a custom/business domain.", "reputation")


def check_role_account(local_part: str) -> Dict[str, Any]:
    local_lower = local_part.lower().split("+")[0]  # strip Gmail-style aliases
    if local_lower in ROLE_ACCOUNTS:
        return _make_check("Role Account", "WARNING",
                           f"'{local_part}@' is a role/group address — not a personal inbox.", "format")
    return _make_check("Role Account", "PASS",
                       f"'{local_part}@' is a personal address, not a role account.", "format")


def check_typo(domain: str) -> Dict[str, Any]:
    best_match = None
    best_dist = float("inf")
    for common in COMMON_EMAIL_DOMAINS:
        dist = levenshtein_distance(domain, common)
        # Only suggest if distance is small AND the strings are close in length
        if dist < best_dist and dist <= 2 and abs(len(domain) - len(common)) <= 3:
            best_dist = dist
            best_match = common
    if best_match and best_match != domain:
        return _make_check("Typo Detection", "WARNING",
                           f"'{domain}' looks like a typo — did you mean '{best_match}'?", "format")
    return _make_check("Typo Detection", "PASS",
                       f"'{domain}' matches a known domain pattern — no typo detected.", "format")


def check_dns_health(domain: str) -> Dict[str, Any]:
    issues = []
    # Check SPF TXT record
    try:
        txt_answers = resolver.resolve(domain, "TXT")
        spf_found = any("v=spf1" in str(r).lower() for r in txt_answers)
        if not spf_found:
            issues.append("No SPF record found (increases spam risk)")
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        issues.append("No TXT/SPF record")
    except dns.exception.Timeout:
        issues.append("TXT lookup timed out")
    except Exception:
        issues.append("TXT record check failed")

    # Check SOA record
    try:
        resolver.resolve(domain, "SOA")
    except dns.resolver.NoAnswer:
        pass  # Some valid domains don't expose SOA externally
    except dns.resolver.NXDOMAIN:
        issues.append("Domain has no SOA record (possibly invalid)")
    except Exception:
        pass

    if issues:
        return _make_check("DNS Health", "WARNING",
                           "DNS issues: " + "; ".join(issues), "dns")
    return _make_check("DNS Health", "PASS",
                       "SPF record present; DNS configuration looks healthy.", "dns")


def check_normalization(email: str, normalized: str) -> Dict[str, Any]:
    changes = []
    if email != email.strip():
        changes.append("leading/trailing whitespace removed")
    if email.lower() != email:
        changes.append("converted to lowercase")
    try:
        local, domain = email.rsplit("@", 1)
        encoded = domain.encode("idna").decode("ascii")
        if encoded != domain:
            changes.append(f"international domain '{domain}' encoded to '{encoded}'")
    except Exception:
        pass

    if changes:
        return _make_check("Email Normalization", "INFO",
                           f"Normalized: {'; '.join(changes)}. Clean form: {normalized}", "format")
    return _make_check("Email Normalization", "PASS",
                       f"Email is already in clean normalized form: {normalized}", "format")


def compute_risk_score(checks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute a 0–100 risk score. Higher = riskier."""
    weights = {
        "Syntax": 100,
        "Domain Existence": 100,
        "MX Record": 100,
        "A Record": 5,
        "Disposable Domain": 50,
        "Free Email Provider": 5,
        "Role Account": 15,
        "Typo Detection": 20,
        "DNS Health": 10,
        "SMTP Handshake & Mailbox Verification": 100,
    }
    risk = 0
    reasons = []
    check_map = {c["name"]: c for c in checks}
    status_map = {c["name"]: c["status"] for c in checks}

    # Hard gate checks
    if status_map.get("Syntax") == "FAIL":
        detail = check_map.get("Syntax", {}).get("detail", "Invalid email syntax.")
        return {
            "name": "Risk Scoring",
            "status": "FAIL",
            "detail": f"Syntax validation failed: {detail}",
            "category": "summary",
            "score": 100,
            "label": "High Risk",
            "risk_level": "HIGH",
            "campaign_decision": "DO_NOT_SEND",
        }

    if status_map.get("Domain Existence") == "FAIL":
        return {
            "name": "Risk Scoring",
            "status": "FAIL",
            "detail": "Domain existence check failed. Domain does not exist.",
            "category": "summary",
            "score": 100,
            "label": "High Risk",
            "risk_level": "HIGH",
            "campaign_decision": "DO_NOT_SEND",
        }

    if status_map.get("MX Record") == "FAIL":
        return {
            "name": "Risk Scoring",
            "status": "FAIL",
            "detail": "MX record check failed. Domain cannot receive email.",
            "category": "summary",
            "score": 100,
            "label": "High Risk",
            "risk_level": "HIGH",
            "campaign_decision": "DO_NOT_SEND",
        }

    if status_map.get("SMTP Handshake & Mailbox Verification") == "FAIL":
        return {
            "name": "Risk Scoring",
            "status": "FAIL",
            "detail": "SMTP server explicitly rejected mailbox.",
            "category": "summary",
            "score": 100,
            "label": "High Risk",
            "risk_level": "HIGH",
            "campaign_decision": "DO_NOT_SEND",
        }

    # Soft weights for other checks
    for check_name, weight in weights.items():
        if check_name in ("Syntax", "Domain Existence", "MX Record", "SMTP Handshake & Mailbox Verification"):
            continue
        st = status_map.get(check_name, "SKIP")
        if st == "FAIL":
            risk += weight
            reasons.append(f"{check_name} failed")
        elif st == "WARNING":
            risk += weight * 0.5
            reasons.append(f"{check_name} warning")

    smtp_st = status_map.get("SMTP Handshake & Mailbox Verification", "SKIP")
    if smtp_st == "WARNING":
        risk += 35
        reasons.append("SMTP warning / catch-all / timeout")

    risk = min(int(risk), 100)

    if risk == 0:
        label = "Very Low Risk"
        risk_level = "LOW"
        decision = "SAFE_TO_SEND"
        status = "PASS"
        detail = "All checks passed. This email looks safe to use."
    elif risk <= 20:
        label = "Low Risk"
        risk_level = "LOW"
        decision = "SAFE_TO_SEND"
        status = "PASS"
        detail = "Minor issues detected but email is likely deliverable."
    elif risk <= 70:
        label = "Medium Risk"
        risk_level = "MEDIUM"
        decision = "SEND_WITH_CAUTION"
        status = "WARNING"
        detail = "Some concerns: " + "; ".join(reasons[:3])
    else:
        label = "High Risk"
        risk_level = "HIGH"
        decision = "DO_NOT_SEND"
        status = "FAIL"
        detail = "Critical issues: " + "; ".join(reasons)

    return {
        "name": "Risk Scoring",
        "status": status,
        "detail": detail,
        "category": "summary",
        "score": risk,
        "label": label,
        "risk_level": risk_level,
        "campaign_decision": decision,
    }


# ---------------------------------------------------------------------------
# Public API: check_email_detailed
# ---------------------------------------------------------------------------

def check_email_detailed(raw_email: str) -> Dict[str, Any]:
    """
    Run all 12 checks on an email address.
    Returns a structured result with each check's status.
    """
    # Pre-normalize
    normalized = normalize_email(raw_email)

    checks: List[Dict[str, Any]] = []

    # 1. Syntax
    syntax_result = check_syntax(normalized)
    checks.append(syntax_result)

    # If syntax fails, skip DNS-dependent checks
    if syntax_result["status"] == "FAIL":
        skip_msg = "Skipped — syntax error prevents further checks."
        for name in ["Domain Existence", "MX Record", "A Record", "Disposable Domain",
                     "Free Email Provider", "Role Account", "Typo Detection",
                     "Domain Age/Reputation", "DNS Health", "Email Normalization",
                     "SMTP Handshake & Mailbox Verification"]:
            checks.append(_make_check(name, "SKIP", skip_msg))
        risk = compute_risk_score(checks)
        checks.append(risk)
        return _build_response(raw_email, normalized, checks, risk)

    try:
        local_part, domain = normalized.rsplit("@", 1)
    except ValueError:
        for name in ["Domain Existence", "MX Record", "A Record"]:
            checks.append(_make_check(name, "SKIP", "Could not parse domain."))
        risk = compute_risk_score(checks)
        checks.append(risk)
        return _build_response(raw_email, normalized, checks, risk)

    # 2. Domain existence
    domain_check, domain_exists = check_domain_existence(domain)
    checks.append(domain_check)

    # 3. MX record
    mx_check, mx_list = check_mx_record(domain)
    checks.append(mx_check)

    # 4. A record
    checks.append(check_a_record(domain))

    # 5. Disposable domain
    checks.append(check_disposable(domain))

    # 6. Free email provider
    checks.append(check_free_provider(domain))

    # 7. Role account
    checks.append(check_role_account(local_part))

    # 8. Typo detection
    checks.append(check_typo(domain))

    # 9. Domain age/reputation (RDAP lookup — no port 25)
    checks.append(check_domain_reputation(domain))

    # 10. DNS health
    checks.append(check_dns_health(domain))

    # 11. Email normalization
    checks.append(check_normalization(raw_email, normalized))

    # 12. Real SMTP Handshake & Mailbox Verification
    validator = SMTPValidator(connect_timeout=10.0, banner_timeout=15.0, command_timeout=10.0)
    smtp_res = validator.check_email_smtp(normalized)
    smtp_cls = smtp_res.get("Final classification", "UNKNOWN")
    smtp_reason = smtp_res.get("Reason", "")
    smtp_code = smtp_res.get("SMTP response code", "")
    smtp_catch_all = smtp_res.get("catch_all", False)
    smtp_catch_all_note = smtp_res.get("catch_all_note", "")
    smtp_mx_host = smtp_res.get("Selected MX", "")
    smtp_response_raw = smtp_res.get("RCPT TO response", "")

    if smtp_cls in ("VALID", "ACCEPTED"):
        if smtp_catch_all:
            checks.append(_make_check(
                "SMTP Handshake & Mailbox Verification", "PASS",
                f"✅ Mailbox accepted (Code {smtp_code}). ⚠️ Domain is catch-all: server accepts all addresses — mailbox existence cannot be independently confirmed.", "smtp"
            ))
        else:
            checks.append(_make_check(
                "SMTP Handshake & Mailbox Verification", "PASS",
                f"✅ Mailbox exists and accepted RCPT TO (Code {smtp_code}). This email is deliverable.", "smtp"
            ))
    elif smtp_cls == "RISKY_CATCH_ALL":
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "WARNING",
            f"⚠️ Catch-All domain: server accepted this address but also accepts any random address. Mailbox existence cannot be verified. Treat as RISKY.", "smtp"
        ))
    elif smtp_cls == "INVALID":
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "FAIL",
            f"❌ SMTP server explicitly rejected this address (Code {smtp_code}): {smtp_reason}. NOT DELIVERABLE.", "smtp"
        ))
    elif smtp_cls == "TEMPORARY_FAILURE":
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "WARNING",
            f"⏳ Temporary SMTP failure (greylisting/rate-limit). Try again later. Code {smtp_code}: {smtp_reason}", "smtp"
        ))
    elif smtp_cls == "TIMEOUT":
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "WARNING",
            f"🕐 SMTP connection timed out. Port 25 may be blocked (ISP/firewall). Deploy to Contabo VPS for accurate results.", "smtp"
        ))
    elif smtp_cls in ("DNS_ERROR", "NO_MX"):
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "FAIL",
            f"❌ Cannot reach mail server ({smtp_cls}): {smtp_reason}", "smtp"
        ))
    elif smtp_cls == "CONNECTION_ERROR":
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "WARNING",
            f"⚠️ SMTP Connection Error (Port 25 blocked or IP binding issue): {smtp_reason}", "smtp"
        ))
    elif smtp_cls == "SMTP_BANNER_TIMEOUT":
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "WARNING",
            f"⚠️ TCP connected but SMTP banner timed out. Treat as UNKNOWN.", "smtp"
        ))
    elif smtp_cls == "TCP_CONNECTION_FAILED":
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "WARNING",
            f"⚠️ TCP connection failed (port 25 blocked or host down).", "smtp"
        ))
    elif smtp_cls == "SMTP_TIMEOUT_AFTER_CONNECTION":
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "WARNING",
            f"⚠️ SMTP command timed out after connection.", "smtp"
        ))
    elif smtp_cls == "SOURCE_IP_BIND_ERROR":
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "WARNING",
            f"⚠️ Could not bind to source IP. Check VPS network config.", "smtp"
        ))
    else:
        checks.append(_make_check(
            "SMTP Handshake & Mailbox Verification", "WARNING",
            f"SMTP check returned inconclusive result ({smtp_cls}): {smtp_reason}", "smtp"
        ))

    # 13. Risk scoring
    risk = compute_risk_score(checks)
    checks.append(risk)

    return _build_response(raw_email, normalized, checks, risk, smtp_res)


def check_domain_reputation(domain: str) -> Dict[str, Any]:
    """Check domain reputation via RDAP (HTTPS). Falls back gracefully."""
    import httpx
    try:
        # RDAP lookup via IANA bootstrap
        rdap_url = f"https://rdap.org/domain/{domain}"
        with httpx.Client(timeout=5.0, follow_redirects=True) as client:
            resp = client.get(rdap_url)

        if resp.status_code == 200:
            data = resp.json()
            # Try to extract registration date
            events = data.get("events", [])
            reg_date = None
            for ev in events:
                if ev.get("eventAction") in ("registration", "Registration"):
                    reg_date = ev.get("eventDate", "")[:10]
                    break
            if reg_date:
                return _make_check("Domain Age/Reputation", "PASS",
                                   f"Domain registered on {reg_date}. Established domain.", "reputation")
            return _make_check("Domain Age/Reputation", "PASS",
                               "Domain found in RDAP registry — appears legitimate.", "reputation")
        elif resp.status_code == 404:
            return _make_check("Domain Age/Reputation", "WARNING",
                               "Domain not found in RDAP registry — may be newly registered or private.", "reputation")
        else:
            return _make_check("Domain Age/Reputation", "INFO",
                               f"RDAP lookup returned status {resp.status_code}.", "reputation")
    except Exception as e:
        return _make_check("Domain Age/Reputation", "INFO",
                           "Could not check domain reputation (RDAP unavailable).", "reputation")


def _build_response(raw_email: str, normalized: str, checks: List[Dict[str, Any]], risk: Dict[str, Any], smtp_res: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Build the final response. Overall status is driven primarily by SMTP result."""
    score = risk.get("score", 0)
    risk_level = risk.get("risk_level", "HIGH" if score >= 70 else ("MEDIUM" if score >= 25 else "LOW"))
    risk_label = risk.get("label", f"{risk_level.title()} Risk")
    campaign_decision = risk.get("campaign_decision", "DO_NOT_SEND" if risk_level == "HIGH" else ("SEND_WITH_CAUTION" if risk_level == "MEDIUM" else "SAFE_TO_SEND"))

    check_map = {c["name"]: c for c in checks}
    syntax_check = check_map.get("Syntax", {})
    syntax_status = syntax_check.get("status", "PASS")

    domain_check = check_map.get("Domain Existence", {})
    domain_valid = domain_check.get("status") == "PASS"

    mx_check = check_map.get("MX Record", {})
    mx_status = mx_check.get("status", "PASS")
    mx_valid = mx_status == "PASS"

    smtp_check = check_map.get("SMTP Handshake & Mailbox Verification", {})
    smtp_status = smtp_check.get("status", "SKIP")

    # Pull structured fields from the raw SMTP result dict
    smtp_cls = smtp_res.get("Final classification", "UNKNOWN") if smtp_res else "UNKNOWN"
    catch_all = smtp_res.get("catch_all", False) if smtp_res else False
    catch_all_note = smtp_res.get("catch_all_note", "") if smtp_res else ""
    mx_host = smtp_res.get("Selected MX", "") if smtp_res else ""
    smtp_code_raw = smtp_res.get("SMTP response code", "") if smtp_res else ""
    smtp_response_raw = smtp_res.get("RCPT TO response", "") if smtp_res else ""

    smtp_reachable = smtp_cls not in ("DNS_ERROR", "NO_MX", "TCP_CONNECTION_FAILED", "CONNECTION_ERROR",
                                       "SOURCE_IP_BIND_ERROR", "SMTP_BANNER_TIMEOUT") and smtp_status != "SKIP"
    mailbox_verified = smtp_cls in ("VALID", "ACCEPTED") and not catch_all

    # 1. Syntax failure (HARD GATE)
    if syntax_status == "FAIL":
        status = "INVALID"
        reason = "Invalid email syntax"
        score = 100
        risk_level = "HIGH"
        risk_label = "High Risk"
        campaign_decision = "DO_NOT_SEND"
    # 2. Domain or MX failure (HARD GATE)
    elif domain_check.get("status") == "FAIL" or mx_status == "FAIL":
        status = "INVALID"
        reason = domain_check.get("detail") if domain_check.get("status") == "FAIL" else mx_check.get("detail", "MX record lookup failed")
        score = 100
        risk_level = "HIGH"
        risk_label = "High Risk"
        campaign_decision = "DO_NOT_SEND"
    # 3. SMTP explicit rejection (550/553)
    elif smtp_status == "FAIL" or smtp_cls == "INVALID":
        status = "NOT_DELIVERABLE"
        reason = "SMTP server explicitly rejected this address. Mailbox does not exist."
        score = 100
        risk_level = "HIGH"
        risk_label = "High Risk"
        campaign_decision = "DO_NOT_SEND"
    # 4. SMTP acceptance
    elif smtp_cls in ("VALID", "ACCEPTED"):
        if catch_all:
            status = "DELIVERABLE"
            reason = "SMTP server accepted the recipient. Domain is catch-all; mailbox existence cannot be independently confirmed."
            score = 35
            risk_level = "MEDIUM"
            risk_label = "Medium Risk"
            campaign_decision = "SEND_WITH_CAUTION"
        else:
            status = "DELIVERABLE"
            reason = "SMTP server accepted the recipient. Mailbox confirmed."
            score = 0
            risk_level = "LOW"
            risk_label = "Low Risk"
            campaign_decision = "SAFE_TO_SEND"
    elif smtp_cls == "RISKY_CATCH_ALL":
        status = "RISKY"
        reason = "Domain is catch-all; SMTP accepted this address but also accepts any random address. Mailbox existence cannot be confirmed."
        score = 60
        risk_level = "MEDIUM"
        risk_label = "Medium Risk"
        campaign_decision = "SEND_WITH_CAUTION"
    elif smtp_status == "WARNING":
        status = "RISKY"
        reason = "Temporary SMTP failure, timeout, anti-enumeration, or network issue prevented reliable verification."
        score = 50
        risk_level = "MEDIUM"
        risk_label = "Medium Risk"
        campaign_decision = "SEND_WITH_CAUTION"
    else:
        if score >= 70:
            status = "NOT_DELIVERABLE"
            reason = "High risk score indicates undeliverable email."
            risk_level = "HIGH"
            risk_label = "High Risk"
            campaign_decision = "DO_NOT_SEND"
        elif score >= 25:
            status = "RISKY"
            reason = "Moderate risk score without definitive SMTP verification."
            risk_level = "MEDIUM"
            risk_label = "Medium Risk"
            campaign_decision = "SEND_WITH_CAUTION"
        else:
            status = "UNKNOWN"
            reason = "Could not perform SMTP verification."
            score = 0
            risk_level = "LOW"
            risk_label = "Low Risk"
            campaign_decision = "SAFE_TO_SEND"

    confidence = "high" if (status == "DELIVERABLE" and not catch_all) or (status in ("INVALID", "NOT_DELIVERABLE") and score == 100) else ("medium" if catch_all else "low")

    return {
        "email": raw_email,
        "normalized_email": normalized,
        "status": status,
        "overall_status": status,  # Kept for backward compatibility
        "reason": reason,
        "risk_score": score,
        "risk_level": risk_level,
        "risk_label": risk_label,
        "campaign_decision": campaign_decision,
        "domain_valid": domain_valid,
        "mx_valid": mx_valid,
        "mx_host": mx_host,
        "smtp_reachable": smtp_reachable,
        "mailbox_verified": mailbox_verified,
        "catch_all": catch_all,
        "catch_all_note": catch_all_note,
        "smtp_code": int(smtp_code_raw) if str(smtp_code_raw).isdigit() else None,
        "smtp_response": smtp_response_raw,
        "verification_confidence": confidence,
        "checks": checks,
    }



# ---------------------------------------------------------------------------
# Legacy API: check_email (used by CSV batch jobs — UNCHANGED behavior)
# ---------------------------------------------------------------------------

def get_mx_records(domain: str) -> list:
    try:
        answers = resolver.resolve(domain, "MX")
        records = sorted(answers, key=lambda r: r.preference)
        return [str(r.exchange).rstrip(".") for r in records]
    except dns.resolver.NoAnswer:
        try:
            resolver.resolve(domain, "A")
            return [domain]
        except Exception:
            return []
    except (dns.resolver.NXDOMAIN, dns.resolver.NoNameservers):
        return []
    except dns.exception.Timeout as e:
        logger.warning(f"DNS timeout for {domain}")
        raise e
    except Exception as e:
        logger.error(f"DNS lookup error for {domain}: {e}")
        return []


def is_valid_syntax(email: str) -> bool:
    pattern = r"^[a-zA-Z0-9_.+\-\/]+@[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-.]+$"
    return re.match(pattern, email) is not None


def check_email(email: str) -> Tuple[str, str]:
    """
    Legacy single-check for CSV batch jobs.
    Returns (status, reason).
    """
    if not email or not isinstance(email, str):
        return "NOT DELIVERABLE", "Empty or invalid input"

    email = email.strip().rstrip(",;- ")

    if email.count("@") > 1:
        pattern = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
        sub_emails = re.findall(pattern, email)
        if len(sub_emails) > 1:
            has_invalid = False
            has_unknown = False
            reasons = []
            for sub_email in sub_emails:
                st, reas = _legacy_check_single(sub_email)
                if st == "NOT DELIVERABLE":
                    has_invalid = True
                elif st in ("UNKNOWN", "RISKY"):
                    has_unknown = True
                reasons.append(f"{sub_email}: {reas}")
            if has_invalid:
                return "NOT DELIVERABLE", " | ".join(reasons)
            elif has_unknown:
                return "UNKNOWN", " | ".join(reasons)
            else:
                return "DELIVERABLE", "All emails deliverable"

    return _legacy_check_single(email)


def _legacy_check_single(email: str) -> Tuple[str, str]:
    """Internal single-email check for legacy batch use."""
    if not is_valid_syntax(email):
        return "NOT DELIVERABLE", "Invalid email syntax"
    try:
        local_part, domain = email.split("@")
    except ValueError:
        return "NOT DELIVERABLE", "Invalid email format"

    domain = domain.lower()

    if domain in DISPOSABLE_DOMAINS:
        return "NOT DELIVERABLE", "Disposable email domain"

    validator = SMTPValidator(connect_timeout=10.0, banner_timeout=15.0, command_timeout=10.0)
    res = validator.check_email_smtp(email)
    cls = res.get("Final classification", "UNKNOWN")
    reason = res.get("Reason", "")
    code = res.get("SMTP response code", "")

    if cls in ("VALID", "ACCEPTED"):
        return "DELIVERABLE", f"SMTP RCPT TO accepted (Code {code}). Mailbox confirmed."
    elif cls == "RISKY_CATCH_ALL":
        return "RISKY", "Domain is catch-all; SMTP accepted the recipient but mailbox existence cannot be confirmed."
    elif cls in ("INVALID", "INVALID_SYNTAX", "NO_MX", "DNS_ERROR"):
        return "NOT_DELIVERABLE", f"SMTP rejected (Code {code}): {reason}"
    elif cls == "TEMPORARY_FAILURE":
        return "RISKY", f"Temporary SMTP failure (greylisting/rate-limit): {reason}"
    elif cls in ("TIMEOUT", "CONNECTION_ERROR", "TCP_CONNECTION_FAILED", "SMTP_BANNER_TIMEOUT", "SMTP_TIMEOUT_AFTER_CONNECTION", "SOURCE_IP_BIND_ERROR"):
        return "UNKNOWN", f"Cannot verify mail server ({cls}). Deploy to VPS or check network."
    else:
        return "UNKNOWN", f"Inconclusive SMTP result ({cls}): {reason}"


# ---------------------------------------------------------------------------
# Advanced SMTP Validation
# ---------------------------------------------------------------------------

def generate_random_string(length=15):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

class CustomSMTP(smtplib.SMTP):
    """Custom SMTP subclass to handle explicit IPv4 binding, separate timeouts, and state tracking."""
    def __init__(self, connect_timeout=15, banner_timeout=20, command_timeout=15, **kwargs):
        self.connect_timeout = connect_timeout
        self.banner_timeout = banner_timeout
        self.command_timeout = command_timeout
        self.tcp_connected = False
        self.banner_received = False
        self.dest_ip = None
        self.source_ip = None
        self.bind_error = None
        super().__init__(**kwargs)

    def _get_socket(self, host, port, timeout):
        if self.debuglevel > 0:
            self._print_debug('connect:', (host, port))
        import socket
        info = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
        err = None
        for res in info:
            af, socktype, proto, canonname, sa = res
            sock = None
            try:
                sock = socket.socket(af, socktype, proto)
                sock.settimeout(self.connect_timeout)
                if self.source_address:
                    try:
                        sock.bind(self.source_address)
                        self.source_ip = self.source_address[0]
                    except socket.error as e:
                        self.bind_error = e
                        raise
                sock.connect(sa)
                self.dest_ip = sa[0]
                self.tcp_connected = True
                
                # Switch to banner timeout for the getreply() call in connect()
                sock.settimeout(self.banner_timeout)
                return sock
            except socket.error as _:
                err = _
                if sock is not None:
                    sock.close()
        if err is not None:
            raise err
        raise socket.error("getaddrinfo returns an empty list")

    def connect(self, host='localhost', port=0, source_address=None):
        res = super().connect(host, port, source_address)
        # If we got here, getreply (banner) succeeded.
        self.banner_received = True
        # Switch to command timeout for remaining commands (EHLO, MAIL FROM, etc)
        if self.sock:
            self.sock.settimeout(self.command_timeout)
        return res

class SMTPValidator:
    def __init__(self, connect_timeout=10.0, banner_timeout=15.0, command_timeout=10.0,
                 sender: str = None, helo_host: str = None):
        self.connect_timeout = connect_timeout
        self.banner_timeout = banner_timeout
        self.command_timeout = command_timeout
        # Use env vars as defaults; callers can still override via constructor
        self.sender = sender or SMTP_VERIFICATION_FROM
        self.helo_host = helo_host or SMTP_HELO_HOST

    def check_email_smtp(self, email: str) -> Dict[str, Any]:
        """
        Perform a full SMTP check on the given email address.
        Returns a dict with classification and details.
        """
        start_time = time.time()
        result = {
            "Email": email,
            "Domain": "",
            "MX records": [],
            "Selected MX": "",
            "MX priority": "",
            "DNS result": "",
            "TCP connection result": "",
            "TCP latency": 0.0,
            "SMTP banner": "",
            "EHLO response": "",
            "MAIL FROM response": "",
            "RCPT TO response": "",
            "SMTP response code": "",
            "Final classification": "UNKNOWN",
            "Reason": "",
            "Timestamp": datetime.now().isoformat()
        }

        # 1. Syntax check (reuse existing)
        if not is_valid_syntax(email):
            result["Final classification"] = "INVALID_SYNTAX"
            result["Reason"] = "Invalid email format"
            return result

        try:
            local_part, domain = email.split("@")
            result["Domain"] = domain
        except ValueError:
            result["Final classification"] = "INVALID_SYNTAX"
            result["Reason"] = "Could not split local and domain"
            return result

        # 2. MX Record Selection
        try:
            answers = resolver.resolve(domain, "MX")
            records = sorted(answers, key=lambda r: r.preference)
            mx_list = [(r.preference, str(r.exchange).rstrip(".")) for r in records]
            result["MX records"] = [mx[1] for mx in mx_list]
            result["DNS result"] = "SUCCESS"
        except dns.resolver.NXDOMAIN:
            result["Final classification"] = "DNS_ERROR"
            result["Reason"] = "NXDOMAIN - Domain does not exist"
            result["DNS result"] = "NXDOMAIN"
            return result
        except dns.resolver.NoAnswer:
            # Fallback to A record (implicit MX)
            try:
                a_answers = resolver.resolve(domain, "A")
                mx_list = [(0, domain)]
                result["MX records"] = [domain]
                result["DNS result"] = "SUCCESS (A Record Fallback)"
            except Exception:
                result["Final classification"] = "NO_MX"
                result["Reason"] = "No MX or A records found"
                result["DNS result"] = "NO_MX"
                return result
        except dns.exception.Timeout:
            result["Final classification"] = "DNS_ERROR"
            result["Reason"] = "DNS lookup timed out"
            result["DNS result"] = "TIMEOUT"
            return result
        except Exception as e:
            result["Final classification"] = "DNS_ERROR"
            result["Reason"] = f"DNS Error: {str(e)}"
            result["DNS result"] = "ERROR"
            return result

        if not mx_list:
            result["Final classification"] = "NO_MX"
            result["Reason"] = "No MX records found"
            result["DNS result"] = "NO_MX"
            return result

        # 3. SMTP checking over MX records
        last_connection_err = None
        for pref, mx in mx_list:
            result["Selected MX"] = mx
            result["MX priority"] = pref

            smtp_res = self._probe_mx(mx, email, result, start_time)
            result.update(smtp_res)

            final_cls = smtp_res.get("Final classification", "UNKNOWN")

            # Definitive connection failure → try next MX
            if final_cls in ("TCP_CONNECTION_FAILED", "CONNECTION_ERROR", "SMTP_BANNER_TIMEOUT",
                             "SMTP_TIMEOUT_AFTER_CONNECTION", "SOURCE_IP_BIND_ERROR"):
                last_connection_err = smtp_res
                logger.warning(f"[SMTP] MX {mx} failed with {final_cls}, trying next MX if available")
                continue

            # Got a definitive answer (VALID, INVALID, TEMPORARY_FAILURE, etc.) — stop
            break

        # Catch-all detection: ONLY run if mailbox itself was positively accepted (VALID/ACCEPTED)
        # The catch-all probe result is stored as metadata, NOT used to downgrade the mailbox result
        result["catch_all"] = False
        result["catch_all_note"] = ""
        if result.get("Final classification") in ("VALID", "ACCEPTED"):
            import uuid
            random_local = f"catchall-probe-{uuid.uuid4().hex[:12]}"
            random_email = f"{random_local}@{domain}"
            logger.info(f"[CATCH-ALL] Testing random address: {random_email}")
            catch_all_res = self._probe_mx(result["Selected MX"], random_email, {}, start_time, is_catch_all_probe=True)
            random_cls = catch_all_res.get("Final classification", "UNKNOWN")
            logger.info(f"[CATCH-ALL] Random probe result: {random_cls}")
            if random_cls in ("VALID", "ACCEPTED"):
                # Domain is catch-all. The REQUESTED mailbox stays VALID since it was explicitly accepted.
                # We annotate with catch_all=True so callers can adjust confidence level.
                result["catch_all"] = True
                result["catch_all_note"] = (
                    "Domain accepts arbitrary recipients; mailbox existence cannot be independently confirmed."
                )
                logger.info(f"[CATCH-ALL] Domain {domain} is catch-all. Requested mailbox stays VALID; catch_all=True annotated.")
            else:
                result["catch_all"] = False
                logger.info(f"[CATCH-ALL] Domain {domain} is NOT catch-all (random probe returned {random_cls}).")
        elif result.get("Final classification") not in ("VALID", "ACCEPTED") and result.get("Final classification") not in (
            "INVALID", "INVALID_SYNTAX", "DNS_ERROR", "NO_MX"
        ):
            # For ambiguous / non-rejected cases, also try catch-all probe
            # If random is accepted on an ambiguous domain, mark as RISKY_CATCH_ALL
            import uuid
            random_local = f"catchall-probe-{uuid.uuid4().hex[:12]}"
            random_email = f"{random_local}@{domain}"
            catch_all_res = self._probe_mx(result["Selected MX"], random_email, {}, start_time, is_catch_all_probe=True)
            if catch_all_res.get("Final classification") in ("VALID", "ACCEPTED"):
                result["catch_all"] = True
                result["catch_all_note"] = "Domain accepts arbitrary recipients; verification is unreliable."

        # Log final result
        elapsed = round(time.time() - start_time, 3)
        logger.info(
            f"[RESULT] email={email} domain={domain} mx={result.get('Selected MX', '')} "
            f"src_ip={SMTP_SOURCE_IP or 'auto'} helo={self.helo_host} sender={self.sender} "
            f"smtp_code={result.get('SMTP response code', '')} "
            f"final={result.get('Final classification', 'UNKNOWN')} "
            f"catch_all={result.get('catch_all', False)} elapsed={elapsed}s"
        )
        return result

    def _probe_mx(self, mx: str, email: str, result: dict, start_time: float, is_catch_all_probe: bool = False) -> dict:
        if is_catch_all_probe:
            res = {}
        else:
            res = result
            
        conn_start = time.time()
        server = None
        
        # Logging prefix
        log_domain = result.get("Domain", "")
        logger.info(f"[DNS] domain={log_domain}")
        logger.info(f"[MX] {mx}")

        try:
            # 4. TCP Port 25 Connection
            server = CustomSMTP(
                connect_timeout=self.connect_timeout,
                banner_timeout=self.banner_timeout,
                command_timeout=self.command_timeout
            )
            
            if SMTP_SOURCE_IP and ":" not in SMTP_SOURCE_IP:
                server.source_address = (SMTP_SOURCE_IP, 0)
                
            server.connect(mx, 25)
            
            res["TCP latency"] = round(time.time() - conn_start, 3)
            res["TCP connection result"] = "CONNECTED"
            
            # Log successful connection
            src = server.source_ip or "auto"
            dst = server.dest_ip or "unknown"
            logger.info(f"[CONNECT] source={src} destination={dst}:25")
            logger.info(f"[TCP] connected={server.tcp_connected}")
            logger.info(f"[BANNER] received={server.banner_received}")

            # Read banner (smtplib checks for 220 internally on connect)
            res["SMTP banner"] = "220"

            # 5. EHLO (preferred over HELO — enables extended SMTP features)
            try:
                code, msg = server.ehlo(self.helo_host)
                if code != 250:
                    code, msg = server.helo(self.helo_host)
            except Exception:
                code, msg = server.helo(self.helo_host)
            res["EHLO response"] = f"{code} {msg.decode('utf-8', errors='ignore')}"

            # 6. MAIL FROM
            code, msg = server.docmd("MAIL FROM:", f"<{self.sender}>")
            res["MAIL FROM response"] = f"{code} {msg.decode('utf-8', errors='ignore')}"

            # 7. RCPT TO — this is the mailbox existence check
            code, msg = server.docmd("RCPT TO:", f"<{email}>")
            resp_str = f"{code} {msg.decode('utf-8', errors='ignore')}"
            res["RCPT TO response"] = resp_str
            res["SMTP response code"] = str(code)

            # 8. Classification based on RCPT TO response
            self._classify_response(code, resp_str, res)

            # 9. QUIT gracefully (do NOT send DATA)
            try:
                server.quit()
            except Exception:
                pass

        except socket.timeout:
            res["TCP latency"] = round(time.time() - conn_start, 3)
            if server and getattr(server, 'tcp_connected', False):
                res["TCP connection result"] = "CONNECTED"
                
                src = getattr(server, 'source_ip', 'auto')
                dst = getattr(server, 'dest_ip', 'unknown')
                logger.info(f"[CONNECT] source={src} destination={dst}:25")
                logger.info(f"[TCP] connected=True")
                logger.info(f"[BANNER] received={getattr(server, 'banner_received', False)}")
                
                if not getattr(server, 'banner_received', False):
                    res["Final classification"] = "SMTP_BANNER_TIMEOUT"
                    res["Reason"] = "TCP connection succeeded, but SMTP banner timed out"
                    logger.info(f"[RESULT] UNKNOWN / SMTP_BANNER_TIMEOUT")
                else:
                    res["Final classification"] = "SMTP_TIMEOUT_AFTER_CONNECTION"
                    res["Reason"] = "SMTP command timed out after successful connection"
            else:
                res["TCP connection result"] = "TIMEOUT"
                res["Final classification"] = "TCP_CONNECTION_FAILED"
                res["Reason"] = "TCP connection timed out"
                logger.info(f"[TCP] connected=False")
        except ConnectionRefusedError:
            res["TCP latency"] = round(time.time() - conn_start, 3)
            res["TCP connection result"] = "CONNECTION_REFUSED"
            res["Final classification"] = "TCP_CONNECTION_FAILED"
            res["Reason"] = "Connection refused by MX server"
            logger.info(f"[TCP] connected=False")
        except socket.error as e:
            res["TCP latency"] = round(time.time() - conn_start, 3)
            if server and getattr(server, 'bind_error', None) is e:
                res["TCP connection result"] = "BIND_ERROR"
                res["Final classification"] = "SOURCE_IP_BIND_ERROR"
                res["Reason"] = f"Failed to bind to source IP: {str(e)}"
            else:
                res["TCP connection result"] = "NETWORK_ERROR"
                res["Final classification"] = "TCP_CONNECTION_FAILED"
                res["Reason"] = f"Network/Socket error: {str(e)}"
            logger.info(f"[TCP] connected=False")
        except smtplib.SMTPConnectError as e:
            res["TCP latency"] = round(time.time() - conn_start, 3)
            res["TCP connection result"] = "SMTP_CONNECT_ERROR"
            res["Final classification"] = "CONNECTION_ERROR"
            res["Reason"] = f"SMTP Connect Error: {e.msg}"
        except smtplib.SMTPServerDisconnected as e:
            res["Final classification"] = "CONNECTION_ERROR"
            res["Reason"] = "SMTP Server Disconnected unexpectedly"
        except smtplib.SMTPException as e:
            res["Final classification"] = "SMTP_ERROR"
            res["Reason"] = f"SMTP Exception: {str(e)}"
        except Exception as e:
            res["Final classification"] = "UNKNOWN"
            res["Reason"] = f"Unexpected Error: {str(e)}"
            
        return res

    def _classify_response(self, code: int, resp_str: str, res: dict):
        if code in (250, 251, 252):
            res["Final classification"] = "VALID" # or ACCEPTED
            res["Reason"] = "SMTP recipient accepted"
        elif code in (550, 551, 552, 553, 511):
            res["Final classification"] = "INVALID"
            res["Reason"] = "SMTP recipient rejected / mailbox does not exist"
        elif code in (421, 450, 451, 452):
            res["Final classification"] = "TEMPORARY_FAILURE"
            res["Reason"] = "Temporary SMTP failure (e.g., rate limit, greylisting, mailbox full)"
        else:
            # Other 5xx errors might mean invalid or server misconfiguration.
            if 500 <= code < 600:
                res["Final classification"] = "INVALID"
                res["Reason"] = f"SMTP fatal error: {resp_str}"
            else:
                res["Final classification"] = "UNKNOWN"
                res["Reason"] = f"Unrecognized SMTP code: {code}"

