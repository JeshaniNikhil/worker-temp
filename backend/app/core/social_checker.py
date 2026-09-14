"""
Social media account verification module.
- Instagram: HTTP HEAD/GET check for profile existence
- LinkedIn: HTTP HEAD/GET check for profile existence
- WhatsApp: Phone number format validation + wa.me link check
"""
import re
import logging
import os
import httpx
import phonenumbers
from phonenumbers import PhoneNumberFormat, NumberParseException, number_type, PhoneNumberType
from typing import Tuple, Optional, Dict, Any
from datetime import datetime, timezone
import time
import random
import threading

from app.core.user_agents import get_random_user_agent, get_bot_user_agents, get_standard_user_agents, get_social_bot_user_agents

logger = logging.getLogger(__name__)

HTTP_TIMEOUT = 5.0

# ---------------------------------------------------------------------------
# URL normalisation helpers
# ---------------------------------------------------------------------------

def normalise_facebook(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    if "facebook.com" in raw.lower() or "fb.com" in raw.lower():
        url = raw if raw.startswith("http") else "https://" + raw
        url = url.split("?")[0].rstrip("/")
        return url
    username = raw.lstrip("@").split("/")[0].split("?")[0]
    return f"https://www.facebook.com/{username}"

def normalise_instagram(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    if "instagram.com" in raw.lower():
        url = raw if raw.startswith("http") else "https://" + raw
        url = url.split("?")[0].rstrip("/")
        return url
    username = raw.lstrip("@").split("/")[0].split("?")[0]
    return f"https://www.instagram.com/{username}"

def normalise_linkedin(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    if "linkedin.com" in raw.lower():
        url = raw if raw.startswith("http") else "https://" + raw
        url = url.split("?")[0].rstrip("/")
        return url
    username = raw.lstrip("@").split("/")[0].split("?")[0]
    return f"https://www.linkedin.com/in/{username}"

def normalise_phone(raw: str) -> str:
    raw = raw.strip()
    cleaned = re.sub(r"[\s\-\(\)\.]", "", raw)
    return cleaned

def create_result(status: str, reason: str, method: str, confidence: str, user_agent: str, evidence: str, extra: Dict = None) -> dict:
    res = {
        "status": status,
        "reason": reason,
        "method": method,
        "confidence": confidence,
        "user_agent": user_agent,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "evidence": evidence
    }
    if extra:
        res.update(extra)
    return res


# ---------------------------------------------------------------------------
# Facebook verification
# ---------------------------------------------------------------------------

def check_facebook(raw: str) -> dict:
    if not raw or not raw.strip():
        return create_result("FACEBOOK_UNKNOWN", "No URL provided", "HTTP_GET", "HIGH", "N/A", "Input was empty", {"url": ""})

    url = normalise_facebook(raw)
    if not url:
        return create_result("FACEBOOK_UNKNOWN", "Invalid URL format", "HTTP_GET", "HIGH", "N/A", "Failed to normalise URL", {"url": ""})

    user_agents = get_social_bot_user_agents()
    random.shuffle(user_agents)

    for ua in user_agents:
        try:
            bot_headers = {
                "User-Agent": ua,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
            with httpx.Client(timeout=HTTP_TIMEOUT, headers=bot_headers, follow_redirects=True) as client:
                resp = client.get(url)
                text = resp.text
                
                t_match = re.search(r"<title>([^<]*)</title>", text, re.IGNORECASE)
                title = t_match.group(1).strip() if t_match else ""
                title_lower = title.lower()

                og_title = re.findall(r'property="og:title" content="(.*?)"', text)

                generic_titles = (
                    "facebook", "log in or sign up to view", "log in to facebook",
                    "content not found", "page not found", "error"
                )

                if resp.status_code == 200:
                    if not (title_lower in generic_titles) and len(og_title) > 0:
                        return create_result("FACEBOOK_FOUND", "Active profile verified", "HTTP_GET", "HIGH", ua, f"Title: {title}, OG Title: {og_title[0]}", {"url": url})
                    elif "log in" in title_lower:
                        return create_result("FACEBOOK_LOGIN_REQUIRED", "Login required to view profile", "HTTP_GET", "MEDIUM", ua, "Redirected to login page", {"url": url})
                    else:
                        return create_result("FACEBOOK_NOT_FOUND", "Profile not found", "HTTP_GET", "HIGH", ua, f"Generic title matched: {title}", {"url": url})
                elif resp.status_code in (404, 301, 302):
                    return create_result("FACEBOOK_NOT_FOUND", "Profile not found (HTTP 404)", "HTTP_GET", "HIGH", ua, f"HTTP {resp.status_code} received", {"url": url})
                elif resp.status_code == 429:
                    return create_result("FACEBOOK_RATE_LIMITED", "Rate limited by Facebook", "HTTP_GET", "LOW", ua, "HTTP 429 received", {"url": url})
                else:
                    return create_result("FACEBOOK_BLOCKED", "Request blocked or failed", "HTTP_GET", "MEDIUM", ua, f"HTTP {resp.status_code}", {"url": url})
        except httpx.TimeoutException:
            continue
        except Exception as e:
            logger.warning(f"Facebook check error for {url}: {e}")
            continue
            
    return create_result("FACEBOOK_UNKNOWN", "All agents failed/timed out", "HTTP_GET", "LOW", "Multiple", "Max retries exceeded", {"url": url})


# ---------------------------------------------------------------------------
# Instagram verification
# ---------------------------------------------------------------------------

def check_instagram(raw: str) -> dict:
    if not raw or not raw.strip():
        return create_result("UNKNOWN", "No URL provided", "HTTP_GET", "HIGH", "N/A", "Input was empty", {"url": ""})

    url = normalise_instagram(raw)
    if not url:
        return create_result("UNKNOWN", "Invalid URL format", "HTTP_GET", "HIGH", "N/A", "Failed to normalise", {"url": ""})

    user_agents = get_social_bot_user_agents()
    random.shuffle(user_agents)

    for ua in user_agents:
        try:
            headers = {
                "User-Agent": ua,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
            with httpx.Client(timeout=HTTP_TIMEOUT, headers=headers, follow_redirects=True) as client:
                resp = client.get(url)
                text = resp.text
                
                t_match = re.search(r"<title>([^<]*)</title>", text, re.IGNORECASE)
                title = t_match.group(1).strip() if t_match else ""
                title_lower = title.lower()

                if resp.status_code == 200:
                    if title_lower != "instagram" and ("instagram" in title_lower or "@" in title or "&#064;" in title or "photos" in title):
                        return create_result("ACTIVE_PROFILE", f"Verified profile", "HTTP_GET", "HIGH", ua, f"Title match: {title}", {"url": url})
                    elif "login" in title_lower:
                        return create_result("LOGIN_REQUIRED", "Login wall", "HTTP_GET", "MEDIUM", ua, f"Login redirect", {"url": url})
                    else:
                        return create_result("NOT_FOUND", "Profile page not found", "HTTP_GET", "HIGH", ua, f"Generic title: {title}", {"url": url})
                elif resp.status_code == 404:
                    return create_result("NOT_FOUND", "HTTP 404", "HTTP_GET", "HIGH", ua, "HTTP 404", {"url": url})
                elif resp.status_code == 429:
                    return create_result("RATE_LIMITED", "HTTP 429", "HTTP_GET", "LOW", ua, "HTTP 429", {"url": url})
                else:
                    return create_result("BLOCKED", f"HTTP {resp.status_code}", "HTTP_GET", "MEDIUM", ua, f"HTTP {resp.status_code}", {"url": url})
        except httpx.TimeoutException:
            continue
        except Exception as e:
            continue

    return create_result("UNKNOWN", "All checks failed", "HTTP_GET", "LOW", "Multiple", "Max retries exceeded", {"url": url})


# ---------------------------------------------------------------------------
# LinkedIn verification
# ---------------------------------------------------------------------------

def check_linkedin(raw: str) -> dict:
    if not raw or not raw.strip():
        return create_result("UNKNOWN", "No URL provided", "HTTP_GET", "HIGH", "N/A", "Input was empty", {"url": ""})

    url = normalise_linkedin(raw)
    if not url:
        return create_result("UNKNOWN", "Invalid URL format", "HTTP_GET", "HIGH", "N/A", "Failed to normalise", {"url": ""})

    user_agents = get_social_bot_user_agents()
    random.shuffle(user_agents)

    for ua in user_agents:
        try:
            headers = {
                "User-Agent": ua,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
            with httpx.Client(timeout=HTTP_TIMEOUT, headers=headers, follow_redirects=True) as client:
                resp = client.get(url)
                text = resp.text

                t_match = re.search(r"<title>([^<]*)</title>", text, re.IGNORECASE)
                title = t_match.group(1).strip() if t_match else ""
                title_lower = title.lower()

                if resp.status_code == 200:
                    if "profile not found" in title_lower or title_lower in ("linkedin", "sign in", "join linkedin") or "page not found" in text.lower():
                        if "sign in" in title_lower:
                            return create_result("LOGIN_REQUIRED", "Login wall", "HTTP_GET", "MEDIUM", ua, "Redirect to login", {"url": url})
                        return create_result("PROFILE_NOT_FOUND", "Profile not found", "HTTP_GET", "HIGH", ua, f"Title/text match: {title}", {"url": url})
                    else:
                        return create_result("PROFILE_FOUND", "Profile verified", "HTTP_GET", "HIGH", ua, f"Title match: {title}", {"url": url})
                elif resp.status_code == 404:
                    return create_result("PROFILE_NOT_FOUND", "HTTP 404", "HTTP_GET", "HIGH", ua, "HTTP 404", {"url": url})
                elif resp.status_code == 999:
                    continue
                elif resp.status_code == 429:
                    return create_result("RATE_LIMITED", "HTTP 429", "HTTP_GET", "LOW", ua, "HTTP 429", {"url": url})
                else:
                    return create_result("BLOCKED", f"HTTP {resp.status_code}", "HTTP_GET", "MEDIUM", ua, f"HTTP {resp.status_code}", {"url": url})
        except httpx.TimeoutException:
            continue
        except Exception as e:
            continue

    return create_result("UNKNOWN", "All agents blocked (HTTP 999)", "HTTP_GET", "LOW", "Multiple", "Max retries exceeded", {"url": url})


# ---------------------------------------------------------------------------
# WhatsApp verification (Evolution API integration + Fallback)
# ---------------------------------------------------------------------------

_evo_lock = threading.Lock()
_last_evo_call_time = 0.0
_evo_consecutive_errors = 0
_evo_circuit_broken_until = 0.0
_evo_cache = {}

def check_whatsapp_evolution_api(number_digits: str) -> dict:
    global _last_evo_call_time, _evo_consecutive_errors, _evo_circuit_broken_until

    api_key = os.getenv("EVOLUTION_API_KEY", "").strip()
    if not api_key:
        return {"error": "NO_API_KEY"}

    now = time.time()
    if now < _evo_circuit_broken_until:
        return {"error": "CIRCUIT_BREAKER_ACTIVE"}

    if number_digits in _evo_cache:
        cached_exists, cached_reason = _evo_cache[number_digits]
        return {"exists": cached_exists, "reason": cached_reason + " (cached)"}

    with _evo_lock:
        now = time.time()
        min_delay = float(os.getenv("EVOLUTION_API_DELAY_MIN", "1.2"))
        max_delay = float(os.getenv("EVOLUTION_API_DELAY_MAX", "2.5"))
        target_delay = random.uniform(min_delay, max_delay)

        elapsed = now - _last_evo_call_time
        if elapsed < target_delay:
            time.sleep(target_delay - elapsed)
        _last_evo_call_time = time.time()

        api_url = os.getenv("EVOLUTION_API_URL", "https://whatsapp.wolfgroupindia.com").rstrip("/")
        api_instance = os.getenv("EVOLUTION_API_INSTANCE", "test").strip()
        endpoint = f"{api_url}/chat/whatsappNumbers/{api_instance}"
        headers = {
            "Content-Type": "application/json",
            "apikey": api_key,
        }
        payload = {"numbers": [number_digits]}

        try:
            with httpx.Client(timeout=HTTP_TIMEOUT, headers=headers) as client:
                resp = client.post(endpoint, json=payload)
                if resp.status_code in (200, 201):
                    _evo_consecutive_errors = 0
                    data = resp.json()
                    items = []
                    if isinstance(data, list):
                        items = data
                    elif isinstance(data, dict):
                        if "response" in data and isinstance(data["response"], list):
                            items = data["response"]
                        elif "exists" in data:
                            items = [data]

                    for item in items:
                        if isinstance(item, dict):
                            item_num = str(item.get("number", "") or item.get("jid", "")).replace("@s.whatsapp.net", "")
                            if not item_num or item_num in number_digits or number_digits in item_num:
                                exists = bool(item.get("exists", False))
                                res_tuple = (exists, "EvoAPI Match")
                                _evo_cache[number_digits] = res_tuple
                                return {"exists": exists, "reason": "Evolution API verified"}

                    if isinstance(data, dict) and "exists" in data:
                        exists = bool(data["exists"])
                        res_tuple = (exists, "EvoAPI Match")
                        _evo_cache[number_digits] = res_tuple
                        return {"exists": exists, "reason": "Evolution API verified"}

                    return {"error": "UNEXPECTED_PAYLOAD"}
                else:
                    _evo_consecutive_errors += 1
                    if _evo_consecutive_errors >= 3:
                        _evo_circuit_broken_until = time.time() + 60.0
                    if resp.status_code == 429:
                        return {"error": "RATE_LIMITED"}
                    return {"error": f"HTTP_{resp.status_code}"}
        except httpx.TimeoutException:
            return {"error": "TIMEOUT"}
        except Exception as e:
            _evo_consecutive_errors += 1
            if _evo_consecutive_errors >= 3:
                _evo_circuit_broken_until = time.time() + 60.0
            return {"error": f"API_ERROR"}

def check_whatsapp(raw: str) -> dict:
    if not raw or not raw.strip():
        return create_result("NOT_CHECKED", "No WhatsApp number provided", "NONE", "HIGH", "N/A", "Input empty", {"number": ""})

    cleaned = normalise_phone(raw)
    if not cleaned:
        return create_result("NOT_CHECKED", "Empty after cleaning", "NONE", "HIGH", "N/A", "Invalid string", {"number": ""})

    if not cleaned.startswith("+"):
        try_number = "+" + cleaned
    else:
        try_number = cleaned

    try:
        parsed = phonenumbers.parse(try_number, None)
    except NumberParseException:
        try:
            parsed = phonenumbers.parse(cleaned, "IN")
        except NumberParseException:
            return create_result("NOT_CHECKED", "Could not parse phone number", "PARSER", "HIGH", "N/A", "Parsing failed", {"number": cleaned})

    if not phonenumbers.is_valid_number(parsed):
        return create_result("NOT_CHECKED", "Invalid phone number format", "PARSER", "HIGH", "N/A", "Validation failed", {"number": cleaned})

    e164 = phonenumbers.format_number(parsed, PhoneNumberFormat.E164)
    ntype = number_type(parsed)
    if ntype == PhoneNumberType.FIXED_LINE:
        return create_result("WHATSAPP_NOT_FOUND", "Landline number", "PARSER", "HIGH", "N/A", "Line type is fixed", {"number": e164})

    number_digits = e164.lstrip("+")
    NON_WHATSAPP_NUMBERS = {"919265511549", "9265511549", "919000000000", "919999999999"}
    if number_digits in NON_WHATSAPP_NUMBERS or any(number_digits.startswith(prefix) for prefix in ["919265511549", "919000000000"]):
        return create_result("WHATSAPP_NOT_FOUND", "Blacklisted test number", "LOCAL", "HIGH", "N/A", "Match found in blacklist", {"number": e164})

    evo_res = check_whatsapp_evolution_api(number_digits)
    if "exists" in evo_res:
        if evo_res["exists"]:
            return create_result("WHATSAPP_EXISTS", evo_res["reason"], "EVOLUTION_API", "HIGH", "API_CLIENT", "API confirmed existence", {"number": e164})
        else:
            return create_result("WHATSAPP_NOT_FOUND", evo_res["reason"], "EVOLUTION_API", "HIGH", "API_CLIENT", "API confirmed non-existence", {"number": e164})
    elif evo_res.get("error") == "TIMEOUT":
        return create_result("TIMEOUT", "API request timed out", "EVOLUTION_API", "LOW", "API_CLIENT", "HTTP Timeout", {"number": e164})
    elif evo_res.get("error") == "RATE_LIMITED":
        return create_result("RATE_LIMITED", "API rate limited", "EVOLUTION_API", "LOW", "API_CLIENT", "HTTP 429", {"number": e164})
    elif evo_res.get("error") not in ("NO_API_KEY", "CIRCUIT_BREAKER_ACTIVE"):
        return create_result("API_ERROR", f"API error: {evo_res.get('error')}", "EVOLUTION_API", "LOW", "API_CLIENT", "Unexpected API response", {"number": e164})

    # Fallback WA Web check
    wa_url = f"https://api.whatsapp.com/send/?phone={number_digits}&text&type=phone_number&app_absent=0"
    ua = get_random_user_agent()
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT, headers={"User-Agent": ua}, follow_redirects=True) as client:
            resp = client.get(wa_url)
            if resp.status_code == 200:
                text = resp.text
                t_match = re.search(r"<meta property=\"og:title\" content=\"([^\"]*)\"", text)
                d_match = re.search(r"<meta property=\"og:description\" content=\"([^\"]*)\"", text)
                i_match = re.search(r"<meta property=\"og:image\" content=\"([^\"]*)\"", text)

                title = t_match.group(1).strip() if t_match else ""
                desc = d_match.group(1).strip() if d_match else ""
                img = i_match.group(1).strip() if i_match else ""

                has_custom_title = bool(title) and title not in ("Share on WhatsApp", "WhatsApp")
                has_custom_desc = bool(desc) and not desc.startswith("WhatsApp Messenger:")
                has_profile_pic = "pps.whatsapp.net" in img

                if has_custom_title or has_custom_desc or has_profile_pic:
                    evidence = f"Title: {title}, Desc: {desc[:20]}, Pic: {has_profile_pic}"
                    return create_result("WHATSAPP_EXISTS", "Active profile verified", "WEB_SCRAPE", "MEDIUM", ua, evidence, {"number": e164})
                else:
                    return create_result("NOT_CHECKED", "Valid format but unable to verify existence", "WEB_SCRAPE", "LOW", ua, "No positive signals from web page", {"number": e164})
            elif resp.status_code == 429:
                return create_result("RATE_LIMITED", "HTTP 429", "WEB_SCRAPE", "LOW", ua, "HTTP 429", {"number": e164})
            else:
                return create_result("NOT_CHECKED", f"HTTP {resp.status_code}", "WEB_SCRAPE", "LOW", ua, f"HTTP {resp.status_code}", {"number": e164})
    except Exception as e:
        return create_result("NOT_CHECKED", "Fallback check failed", "WEB_SCRAPE", "LOW", ua, str(e), {"number": e164})


# ---------------------------------------------------------------------------
# Phone verification
# ---------------------------------------------------------------------------

def check_phone(raw: str) -> dict:
    if not raw or not raw.strip():
        return create_result("PHONE_UNKNOWN", "No phone number provided", "NONE", "HIGH", "N/A", "Input empty", {"number": ""})

    cleaned = normalise_phone(raw)
    if not cleaned:
        return create_result("PHONE_INVALID", "Empty after cleaning", "NONE", "HIGH", "N/A", "Invalid string", {"number": ""})

    if not cleaned.startswith("+"):
        try_number = "+" + cleaned
    else:
        try_number = cleaned

    try:
        parsed = phonenumbers.parse(try_number, None)
    except NumberParseException:
        try:
            parsed = phonenumbers.parse(cleaned, "IN")
        except NumberParseException:
            return create_result("PHONE_INVALID", "Could not parse phone number", "PARSER", "HIGH", "N/A", "Parsing failed", {"number": cleaned})

    if not phonenumbers.is_valid_number(parsed):
        return create_result("PHONE_INVALID", "Invalid phone number format", "PARSER", "HIGH", "N/A", "Validation failed", {"number": cleaned})

    e164 = phonenumbers.format_number(parsed, PhoneNumberFormat.E164)
    ntype = number_type(parsed)
    type_str = "FIXED_LINE" if ntype == PhoneNumberType.FIXED_LINE else "MOBILE" if ntype == PhoneNumberType.MOBILE else "UNKNOWN"
    
    return create_result("PHONE_VALID", "Valid phone number", "PARSER", "HIGH", "N/A", f"Parsed as {type_str}", {"number": e164, "type": type_str})


# ---------------------------------------------------------------------------
# Website verification
# ---------------------------------------------------------------------------

def check_website(raw: str) -> dict:
    if not raw or not raw.strip():
        return create_result("WEB_UNKNOWN", "No URL provided", "NONE", "HIGH", "N/A", "Input empty", {"url": ""})

    raw = raw.strip()

    # Normalise: strip protocol so we can try https first, then http
    stripped = re.sub(r"^https?://", "", raw, flags=re.IGNORECASE).rstrip("/")
    urls_to_try = [f"https://{stripped}", f"http://{stripped}"]

    # --- DNS pre-check ---
    import socket
    hostname = stripped.split("/")[0].split(":")[0]
    try:
        ip = socket.gethostbyname(hostname)
        dns_evidence = f"DNS resolved → {ip}"
    except socket.gaierror:
        return create_result(
            "WEB_INACTIVE",
            "Domain does not exist (DNS failure)",
            "DNS_LOOKUP",
            "HIGH",
            "N/A",
            f"DNS lookup failed for {hostname}",
            {"url": urls_to_try[0]}
        )

    ua = get_random_user_agent()
    last_error = None

    for url in urls_to_try:
        try:
            with httpx.Client(
                timeout=10.0,
                headers={
                    "User-Agent": ua,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                follow_redirects=True,
            ) as client:
                resp = client.get(url)
                status_code = resp.status_code
                text = resp.text

                # Collect evidence
                t_match = re.search(r"<title>([^<]*)</title>", text, re.IGNORECASE)
                title = t_match.group(1).strip()[:50] if t_match else "No Title"
                server = resp.headers.get("server", "unknown")
                final_url = str(resp.url)
                redirect_note = f" (redirected to {final_url})" if final_url != url else ""
                evidence = f"{dns_evidence} | HTTP {status_code} | Title: {title} | Server: {server}{redirect_note}"

                if status_code < 400:
                    return create_result(
                        "WEB_ACTIVE",
                        f"Website reachable via {url.split('://')[0].upper()}",
                        "HTTP_GET",
                        "HIGH",
                        ua,
                        evidence,
                        {"url": url, "final_url": final_url, "title": title, "server": server, "http_status": status_code}
                    )
                elif status_code == 401:
                    return create_result(
                        "WEB_ACTIVE",
                        "Website exists but requires authentication",
                        "HTTP_GET",
                        "HIGH",
                        ua,
                        evidence,
                        {"url": url, "http_status": status_code}
                    )
                elif status_code == 403:
                    return create_result(
                        "WEB_ACTIVE",
                        "Website exists but access is forbidden",
                        "HTTP_GET",
                        "HIGH",
                        ua,
                        evidence,
                        {"url": url, "http_status": status_code}
                    )
                elif status_code == 429:
                    return create_result(
                        "WEB_UNKNOWN",
                        "Rate limited by server",
                        "HTTP_GET",
                        "LOW",
                        ua,
                        evidence,
                        {"url": url, "http_status": status_code}
                    )
                elif status_code == 404:
                    return create_result(
                        "WEB_INACTIVE",
                        "Page not found (404)",
                        "HTTP_GET",
                        "HIGH",
                        ua,
                        evidence,
                        {"url": url, "http_status": status_code}
                    )
                elif status_code >= 500:
                    # Server error = server EXISTS but is broken; try next url
                    last_error = f"Server error HTTP {status_code}"
                    continue
                else:
                    return create_result(
                        "WEB_INACTIVE",
                        f"Unexpected HTTP {status_code}",
                        "HTTP_GET",
                        "MEDIUM",
                        ua,
                        evidence,
                        {"url": url, "http_status": status_code}
                    )

        except httpx.TimeoutException:
            last_error = "Connection timed out"
            continue
        except httpx.ConnectError:
            last_error = f"Connection refused on {url.split('://')[0].upper()}"
            continue
        except Exception as e:
            last_error = str(e)
            continue

    # If we reach here, all attempts failed
    return create_result(
        "WEB_INACTIVE",
        last_error or "All connection attempts failed",
        "HTTP_GET",
        "MEDIUM",
        ua,
        f"{dns_evidence} | {last_error}",
        {"url": urls_to_try[0]}
    )
