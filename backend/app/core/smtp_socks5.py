"""
SOCKS5 SMTP wrapper for email verification via Volknode proxy.
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
SOCKS5_PROXY_PORT = int(os.environ.get("SOCKS5_PROXY_PORT", "1080"))
SOCKS5_PROXY_USER = os.environ.get("SOCKS5_PROXY_USER", "smtpuser").strip()
SOCKS5_PROXY_PASS = os.environ.get("SOCKS5_PROXY_PASS", "change_me_proxy_password").strip()

# SMTP Config
SMTP_VERIFICATION_FROM = os.environ.get("SMTP_VERIFICATION_FROM", "verify@validator.wolfgroupindia.com").strip()
SMTP_HELO_HOST = os.environ.get("SMTP_HELO_HOST", "validator.wolfgroupindia.com").strip()

resolver = dns.resolver.Resolver()
resolver.timeout = 3.0
resolver.lifetime = 5.0


def check_email_via_socks5(email: str, timeout: float = 20.0) -> Tuple[str, str]:
    """
    Verify email via SMTP through SOCKS5 proxy.
    Returns: (status, reason)
    - status: DELIVERABLE | NOT_DELIVERABLE | CATCH_ALL | RISKY | UNKNOWN
    - reason: Human-readable explanation
    """
    try:
        # Parse email
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
        return ("UNKNOWN", f"DNS lookup failed: {e}")

    # Create SOCKS5 socket
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
        logger.info(f"[SMTP-SOCKS5] Connecting to {mx_host}:25 via {SOCKS5_PROXY_HOST}:{SOCKS5_PROXY_PORT}")
        sock.connect((mx_host, 25))
        
        # Wrap in SMTP
        smtp = smtplib.SMTP()
        smtp.sock = sock
        
        # Get banner
        code, banner = smtp.getreply()
        if code != 220:
            sock.close()
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
            # Check for catch-all by testing random address
            return ("DELIVERABLE", f"Mailbox accepted (Code {code})")
        elif code == 550:
            return ("NOT_DELIVERABLE", f"Mailbox rejected: {response_str}")
        elif code == 551:
            return ("NOT_DELIVERABLE", f"User not local: {response_str}")
        elif code == 552:
            return ("NOT_DELIVERABLE", f"Mailbox full: {response_str}")
        elif code == 553:
            return ("NOT_DELIVERABLE", f"Invalid mailbox: {response_str}")
        elif code == 450 or code == 451 or code == 452:
            return ("RISKY", f"Temporary failure (greylisting?): {response_str}")
        else:
            return ("UNKNOWN", f"Unexpected SMTP code {code}: {response_str}")
            
    except socks.ProxyConnectionError as e:
        return ("UNKNOWN", f"SOCKS5 proxy connection failed: {e}")
    except socket.timeout:
        return ("UNKNOWN", "SMTP connection timed out")
    except Exception as e:
        return ("UNKNOWN", f"SMTP error: {e}")
    finally:
        try:
            if 'sock' in locals():
                sock.close()
        except:
            pass


def check_email(email: str) -> Tuple[str, str]:
    """
    Simple email verification using SOCKS5 proxy.
    Compatible with existing codebase.
    Returns: (status, reason)
    """
    return check_email_via_socks5(email, timeout=20.0)
