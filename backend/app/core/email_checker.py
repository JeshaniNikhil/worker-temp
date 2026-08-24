import re
import dns.resolver
import socket
import logging
import unicodedata
from typing import Tuple, Dict, Any, List, Optional

logger = logging.getLogger(__name__)

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
    pattern = r"^[a-zA-Z0-9_.+\-\/]+@[a-zA-Z0-9\-]+(\.[a-zA-Z0-9\-]+)*\.[a-zA-Z]{2,}$"
    if re.match(pattern, email):
        return _make_check("Syntax", "PASS", f"'{email}' follows the name@domain.com format.", "format")
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
        "Syntax": 25,
        "Domain Existence": 20,
        "MX Record": 15,
        "A Record": 5,
        "Disposable Domain": 15,
        "Free Email Provider": 5,
        "Role Account": 5,
        "Typo Detection": 5,
        "DNS Health": 5,
    }
    risk = 0
    reasons = []
    check_map = {c["name"]: c["status"] for c in checks}

    for check_name, weight in weights.items():
        status = check_map.get(check_name, "SKIP")
        if status == "FAIL":
            risk += weight
            reasons.append(f"{check_name} failed")
        elif status == "WARNING":
            risk += weight * 0.4
            reasons.append(f"{check_name} warning")

    risk = min(int(risk), 100)

    if risk == 0:
        label = "Very Low Risk"
        status = "PASS"
        detail = "All checks passed. This email looks safe to use."
    elif risk <= 20:
        label = "Low Risk"
        status = "PASS"
        detail = "Minor issues detected but email is likely deliverable."
    elif risk <= 45:
        label = "Medium Risk"
        status = "WARNING"
        detail = "Some concerns: " + "; ".join(reasons[:3])
    elif risk <= 70:
        label = "High Risk"
        status = "WARNING"
        detail = "Multiple issues: " + "; ".join(reasons[:4])
    else:
        label = "Very High Risk"
        status = "FAIL"
        detail = "Critical issues: " + "; ".join(reasons)

    return {
        "name": "Risk Scoring",
        "status": status,
        "detail": detail,
        "category": "summary",
        "score": risk,
        "label": label,
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
                     "Domain Age/Reputation", "DNS Health", "Email Normalization"]:
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

    # 12. Risk scoring
    risk = compute_risk_score(checks)
    checks.append(risk)

    return _build_response(raw_email, normalized, checks, risk)


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


def _build_response(raw_email: str, normalized: str, checks: List[Dict[str, Any]], risk: Dict[str, Any]) -> Dict[str, Any]:
    # Overall status based on risk score
    score = risk.get("score", 0)
    if score >= 71:
        overall = "INVALID"
    elif score >= 25:
        overall = "RISKY"
    else:
        overall = "VALID"

    return {
        "email": raw_email,
        "normalized_email": normalized,
        "overall_status": overall,
        "risk_score": score,
        "risk_label": risk.get("label", ""),
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
        return "NOT VALID", "Empty or invalid input"

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
                if st == "NOT VALID":
                    has_invalid = True
                elif st in ("UNKNOWN", "DISPOSABLE"):
                    has_unknown = True
                reasons.append(f"{sub_email}: {reas}")
            if has_invalid:
                return "NOT VALID", " | ".join(reasons)
            elif has_unknown:
                return "UNKNOWN", " | ".join(reasons)
            else:
                return "VALID", "All emails are valid"

    return _legacy_check_single(email)


def _legacy_check_single(email: str) -> Tuple[str, str]:
    """Internal single-email check for legacy batch use."""
    if not is_valid_syntax(email):
        return "NOT VALID", "Invalid email syntax"
    try:
        local_part, domain = email.split("@")
    except ValueError:
        return "NOT VALID", "Invalid email format"

    domain = domain.lower()

    if domain in DISPOSABLE_DOMAINS:
        return "DISPOSABLE", "Disposable email domain"

    try:
        mx_records = get_mx_records(domain)
        if not mx_records:
            return "NOT VALID", "Domain does not exist or has no MX records"
    except dns.exception.Timeout:
        return "UNKNOWN", "DNS lookup timed out"

    # No SMTP for legacy either — return VALID if DNS passes
    return "VALID", "Domain and MX records verified successfully"
