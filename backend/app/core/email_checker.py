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

def verify_smtp(mx_record: str, email: str, sender_email: str = "verify@example.com") -> Tuple[str, str]:
    server = None
    try:
        # Connect to SMTP server
        server = smtplib.SMTP(timeout=3)
        server.connect(mx_record)
        
        # Try EHLO/HELO
        try:
            server.ehlo_or_helo_if_needed()
        except Exception as helo_err:
            logger.warning(f"HELO failed for {mx_record}: {helo_err}")
            
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
            return "UNKNOWN", f"SMTP temporary error: {code}"
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

    # Strip whitespace and trailing commas/semicolons
    email = email.strip().rstrip(',;')
    
    # Handle multiple emails delimited by slashes, commas, or semicolons
    if email.count('@') > 1:
        import re
        delimited = re.sub(r'[/;]', ',', email)
        if ',' in delimited:
            sub_emails = [e.strip().rstrip(',;') for e in delimited.split(',')]
            has_invalid = False   # explicit syntax error or SMTP 5xx rejection
            has_unknown = False   # SMTP timeout, refused, or unreachable
            reasons = []
            for sub_email in sub_emails:
                if not sub_email:
                    continue
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
        
    # 4. SMTP Verification
    # With port 25 open (e.g. Oracle Cloud), the SMTP result is fully trusted.
    # UNKNOWN = server unreachable/timed out (cannot confirm mailbox)
    # NOT VALID = server explicitly rejected the recipient (mailbox does not exist)
    # VALID = server accepted the recipient (mailbox exists)
    status, reason = verify_smtp(mx_records[0], email)

    return status, reason
