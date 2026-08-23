import re
import dns.resolver
import smtplib
import socket
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

# Basic disposable domains list. A real-world app would load a much larger list from a file or DB.
DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com",
    "yopmail.com", "dropmail.me", "temp-mail.org", "trashmail.com"
}

def is_valid_syntax(email: str) -> bool:
    # A robust regex for email validation (allows / in local part)
    pattern = r"^[a-zA-Z0-9_.+-\/]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return re.match(pattern, email) is not None

# Configure DNS resolver with strict timeouts to prevent hanging,
# but use the system default nameservers to allow VPN/internal domain resolution.
resolver = dns.resolver.Resolver()
# Removed hardcoded 8.8.8.8 so it uses host/VPN DNS from /etc/resolv.conf
resolver.timeout = 2.0
resolver.lifetime = 3.0

def get_mx_records(domain: str) -> list:
    try:
        answers = resolver.resolve(domain, 'MX')
        # Sort by preference
        records = sorted(answers, key=lambda r: r.preference)
        return [str(r.exchange).rstrip('.') for r in records]
    except dns.resolver.NoAnswer:
        # Fallback to A record if no MX record is found
        try:
            a_answers = resolver.resolve(domain, 'A')
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

import uuid

_catch_all_cache = {}

def is_catch_all(domain: str, mx_records: list) -> bool:
    if domain in _catch_all_cache:
        return _catch_all_cache[domain]
        
    if not mx_records:
        return False
        
    random_local = uuid.uuid4().hex[:12]
    test_email = f"{random_local}@{domain}"
    
    # Check the first MX record for the fake email
    status, _ = verify_smtp(mx_records[0], test_email)
    
    is_ca = (status == "VALID")
    _catch_all_cache[domain] = is_ca
    return is_ca

def verify_smtp(mx_record: str, email: str, sender_email: str = "sales@marketing.wolfgroupindia.com") -> Tuple[str, str]:
    server = None
    try:
        # Connect to SMTP server with a shorter timeout (3s) to prevent frontend hanging
        server = smtplib.SMTP(timeout=3)
        server.connect(mx_record)
        
        # 1. Announce ourselves with a valid FQDN (Host name)
        # Using the actual Contabo PTR record
        try:
            server.ehlo("vmi3488930.contaboserver.net")
        except Exception as helo_err:
            logger.warning(f"EHLO failed for {mx_record}: {helo_err}")
            
        # 2. Upgrade to encrypted connection (STARTTLS)
        # This massively increases our reputation score with Google/Microsoft
        try:
            if server.has_extn('STARTTLS'):
                server.starttls()
                server.ehlo("vmi3488930.contaboserver.net") # Re-announce after encryption
        except Exception as starttls_err:
            logger.warning(f"STARTTLS failed for {mx_record}: {starttls_err}")

        # Try MAIL FROM
        try:
            server.mail(sender_email)
        except Exception as mail_err:
            logger.warning(f"MAIL FROM failed for {mx_record}: {mail_err}")
            try:
                server.mail("")
            except Exception:
                pass
        
        # RCPT TO
        code, message = server.rcpt(email)
        try:
            server.quit()
        except Exception:
            pass
        
        if code == 250:
            return "VALID", "SMTP server reachable"
        elif code >= 400 and code < 500:
            return "GREYLISTED", f"SMTP temporary error (Greylisting): {code}"
        elif code >= 500:
            return "NOT VALID", f"SMTP rejected recipient: {code}"
        else:
            return "UNKNOWN", f"SMTP unknown response: {code}"
            
    except (smtplib.SMTPServerDisconnected, socket.timeout, socket.error) as conn_err:
        if server:
            try:
                server.close()
            except Exception:
                pass
        return "UNKNOWN", "SMTP connection timed out/refused"
    except Exception as e:
        if server:
            try:
                server.close()
            except Exception:
                pass
        logger.error(f"SMTP error for {email} on {mx_record}: {e}")
        return "UNKNOWN", "SMTP connection failed"

def check_email(email: str) -> Tuple[str, str]:
    """
    Checks an email address and returns a tuple of (Status, Reason).
    Statuses: VALID, NOT VALID, DISPOSABLE, UNKNOWN
    """
    if not email or not isinstance(email, str):
        return "NOT VALID", "Empty or invalid input"

    # Strip whitespace and trailing commas/semicolons/hyphens
    email = email.strip().rstrip(',;- ')
    
    # Handle multiple emails delimited by slashes, commas, semicolons, hyphens or spaces
    if email.count('@') > 1:
        import re
        # Find all valid email-like strings within the row
        # This handles commas, spaces, and hyphens natively without breaking normal emails
        pattern = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
        sub_emails = re.findall(pattern, email)
        
        if len(sub_emails) > 1:
            has_invalid = False   # explicit syntax error or SMTP 5xx rejection
            has_unknown = False   # SMTP timeout, refused, or unreachable
            reasons = []
            for sub_email in sub_emails:
                st, reas = check_email_single(sub_email)
                if st == "NOT VALID":
                    has_invalid = True
                elif st in ("UNKNOWN", "DISPOSABLE"):
                    has_unknown = True
                reasons.append(f"{sub_email}: {reas}")

            # Only mark the whole group NOT VALID if there's an explicit rejection.
            # SMTP timeouts/unreachable on some sub-emails should produce UNKNOWN.
            if has_invalid:
                return "NOT VALID", " | ".join(reasons)
            elif has_unknown:
                return "UNKNOWN", " | ".join(reasons)
            else:
                return "VALID", "All emails are valid"
            
    return check_email_single(email)

def check_email_single(email: str) -> Tuple[str, str]:
    # 1. Syntax Check
    if not is_valid_syntax(email):
        return "NOT VALID", "Invalid email syntax"
        
    try:
        local_part, domain = email.split('@')
    except ValueError:
        return "NOT VALID", "Invalid email format"
        
    domain = domain.lower()
    
    # 2. Disposable Domain Check
    if domain in DISPOSABLE_DOMAINS:
        return "DISPOSABLE", "Disposable email domain"
        
    # 3. Domain Existence / MX Check
    try:
        mx_records = get_mx_records(domain)
        if not mx_records:
            return "NOT VALID", "Domain does not exist or has no MX records"
    except dns.exception.Timeout:
        return "UNKNOWN", "DNS lookup timed out (possibly VPN/firewall issue)"
        
    # 4. Catch-All Verification (Optional but increases accuracy)
    # If the domain accepts everything, we flag it as a catch-all.
    ca_flag = False
    if is_catch_all(domain, mx_records):
        ca_flag = True
        
    # 5. SMTP Verification
    # Try up to 2 MX records to avoid massive hanging if port 25 is blocked globally
    status, reason = "UNKNOWN", "No reachable MX servers"
    for mx in mx_records[:2]:
        status, reason = verify_smtp(mx, email)
        # If we get a definitive answer (VALID, NOT VALID, GREYLISTED) stop trying.
        # If it timed out or refused the connection, try the next MX record.
        if status != "UNKNOWN" or "timed out" not in reason.lower():
            break

    if status == "VALID" and ca_flag:
        return "VALID (Catch-All)", "SMTP server reachable but domain is configured as a catch-all"

    return status, reason
