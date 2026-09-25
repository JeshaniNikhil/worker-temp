"""
SOCKS5 SMTP Email Validation via Volknode Proxy
Routes SMTP (port 25) through SOCKS5 proxy to bypass Oracle's port 25 block.
"""
import os
import socket
import socks
import smtplib
import dns.resolver
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

# SOCKS5 Proxy Configuration (Volknode)
SOCKS5_PROXY_HOST = os.environ.get("SOCKS5_PROXY_HOST", "87.251.66.181").strip()
SOCKS5_PROXY_PORT = int(os.environ.get("SOCKS5_PROXY_PORT", "443"))
SOCKS5_PROXY_USER = os.environ.get("SOCKS5_PROXY_USER", "smtpuser").strip()
SOCKS5_PROXY_PASS = os.environ.get("SOCKS5_PROXY_PASS", "change_me_proxy_password").strip()

# SMTP Config
SMTP_VERIFICATION_FROM = os.environ.get("SMTP_VERIFICATION_FROM", "verify@validator.wolfgroupindia.com").strip()
SMTP_HELO_HOST = os.environ.get("SMTP_HELO_HOST", "validator.wolfgroupindia.com").strip()

resolver = dns.resolver.Resolver()
resolver.timeout = 3.0
resolver.lifetime = 5.0


def check_email(email: str, timeout: float = 30.0) -> Tuple[str, str]:
    """
    Verify email via SMTP through SOCKS5 proxy.
    Returns: (status, reason)
    - status: DELIVERABLE | NOT_DELIVERABLE | CATCH_ALL | RISKY | UNKNOWN
    - reason: Human-readable explanation
    """
    try:
        # Parse email
        if "@" not in email:
            return ("UNKNOWN", "Invalid email format")
        local, domain = email.rsplit("@", 1)
    except ValueError:
        return ("UNKNOWN", "Invalid email format")

    # Get MX records
    try:
        mx_records = resolver.resolve(domain, "MX")
        mx_list = sorted(mx_records, key=lambda r: r.preference)
        if not mx_list:
            return ("NOT_DELIVERABLE", "No MX records found")
        mx_host = str(mx_list[0].exchange).rstrip(".")
    except dns.resolver.NXDOMAIN:
        return ("NOT_DELIVERABLE", "Domain does not exist")
    except dns.resolver.NoAnswer:
        return ("NOT_DELIVERABLE", "No MX records found")
    except Exception as e:
        return ("UNKNOWN", f"DNS lookup failed: {str(e)[:50]}")

    # Create SOCKS5 socket
    sock = None
    smtp = None
    try:
        sock = socks.socksocket(socket.AF_INET, socket.SOCK_STREAM)
        sock.set_proxy(
            proxy_type=socks.SOCKS5,
            addr=SOCKS5_PROXY_HOST,
            port=SOCKS5_PROXY_PORT,
            username=SOCKS5_PROXY_USER,
            password=SOCKS5_PROXY_PASS,
        )
        sock.settimeout(timeout)
        
        # Connect to MX server via SOCKS5
        logger.info(f"[SMTP] Connecting to {mx_host}:25 via SOCKS5 {SOCKS5_PROXY_HOST}:{SOCKS5_PROXY_PORT}")
        sock.connect((mx_host, 25))
        
        # Wrap in SMTP
        smtp = smtplib.SMTP()
        smtp.sock = sock
        
        # Get banner
        code, banner = smtp.getreply()
        if code != 220:
            return ("UNKNOWN", f"Unexpected banner code {code}")
        
        # EHLO/HELO
        smtp.ehlo(SMTP_HELO_HOST)
        
        # MAIL FROM
        smtp.mail(SMTP_VERIFICATION_FROM)
        
        # RCPT TO
        code, response = smtp.rcpt(email)
        response_str = response.decode() if isinstance(response, bytes) else str(response)
        
        smtp.quit()
        
        # Interpret response
        if code == 250:
            return ("DELIVERABLE", f"Mailbox accepted")
        elif code == 550:
            return ("NOT_DELIVERABLE", f"Mailbox rejected")
        elif code in [551, 553]:
            return ("NOT_DELIVERABLE", f"Invalid mailbox")
        elif code == 552:
            return ("NOT_DELIVERABLE", f"Mailbox full")
        elif code in [450, 451, 452]:
            return ("RISKY", f"Temporary failure (greylisting)")
        else:
            return ("UNKNOWN", f"SMTP code {code}: {response_str[:50]}")
            
    except socks.ProxyConnectionError as e:
        return ("UNKNOWN", f"SOCKS5 proxy connection failed: {str(e)[:100]}")
    except socket.timeout:
        return ("UNKNOWN", "SMTP connection timed out")
    except Exception as e:
        return ("UNKNOWN", f"SMTP error: {type(e).__name__}: {str(e)[:50]}")
    finally:
        try:
            if smtp:
                smtp.close()
        except:
            pass
        try:
            if sock:
                sock.close()
        except:
            pass

