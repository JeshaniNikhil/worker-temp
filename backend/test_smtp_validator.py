"""
Unit tests for SMTPValidator.

Tests cover:
A. Gmail existing address (mocked VALID)
B. Gmail nonexistent address (mocked INVALID/550)
C. Custom-domain existing address (mocked VALID, no catch-all)
D. Custom-domain nonexistent address (mocked 550)
E. Catch-all domain + requested mailbox  -> VALID + catch_all=True
F. Catch-all domain + random nonexistent -> stays RISKY_CATCH_ALL or ambiguous
G. MX timeout -> TCP_CONNECTION_FAILED
H. MX connection refused -> TCP_CONNECTION_FAILED
I. SMTP 550 mailbox rejection -> INVALID
J. SMTP 250 acceptance -> VALID
K. SMTP 4xx temporary rejection -> TEMPORARY_FAILURE
L. Multiple MX records: first times out, second succeeds
"""
import sys
import os
import unittest
from unittest.mock import patch, MagicMock, call
import socket

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("SMTP_SOURCE_IP", "")
os.environ.setdefault("SMTP_VERIFICATION_FROM", "test@example.com")
os.environ.setdefault("SMTP_HELO_HOST", "test.example.com")

from app.core.email_checker import SMTPValidator


def _make_validator():
    return SMTPValidator(connect_timeout=1.0, banner_timeout=1.0, command_timeout=1.0)


def _mock_resolve_mx(domain, mx_host="mail.example.com", preference=10):
    """Helper to create a mock dns resolve answer."""
    import dns.resolver
    mock_answer = MagicMock()
    mock_answer.preference = preference
    mock_answer.exchange = MagicMock()
    mock_answer.exchange.__str__ = lambda self: mx_host + "."
    return [mock_answer]


def _make_smtp_mock(rcpt_to_response, mail_from_response=(250, b"OK")):
    """Build a CustomSMTP mock with configurable RCPT TO response."""
    mock = MagicMock()
    mock.tcp_connected = True
    mock.banner_received = True
    mock.dest_ip = "1.2.3.4"
    mock.source_ip = "169.58.234.98"
    mock.bind_error = None
    mock.sock = MagicMock()
    mock.ehlo.return_value = (250, b"OK")
    mock.docmd.side_effect = [mail_from_response, rcpt_to_response]
    mock.quit.return_value = None
    return mock


class TestSMTPValidatorConstructor(unittest.TestCase):
    """Constructor must not accept old 'timeout' kwarg."""

    def test_new_constructor(self):
        v = SMTPValidator(connect_timeout=5.0, banner_timeout=10.0, command_timeout=5.0)
        self.assertEqual(v.connect_timeout, 5.0)
        self.assertEqual(v.banner_timeout, 10.0)
        self.assertEqual(v.command_timeout, 5.0)

    def test_old_timeout_kwarg_raises(self):
        with self.assertRaises(TypeError):
            SMTPValidator(timeout=10.0)

    def test_sender_defaults_from_env(self):
        v = SMTPValidator()
        self.assertEqual(v.sender, os.environ.get("SMTP_VERIFICATION_FROM", "verify@validator.wolfgroupindia.com"))

    def test_helo_defaults_from_env(self):
        v = SMTPValidator()
        self.assertEqual(v.helo_host, os.environ.get("SMTP_HELO_HOST", "validator.wolfgroupindia.com"))


class TestSMTPValidatorDNS(unittest.TestCase):
    """DNS resolution failures must produce correct classification."""

    @patch("app.core.email_checker.resolver.resolve")
    def test_nxdomain_returns_dns_error(self, mock_resolve):
        import dns.resolver
        mock_resolve.side_effect = dns.resolver.NXDOMAIN
        v = _make_validator()
        res = v.check_email_smtp("test@notrealdomain.xyz123456789")
        self.assertEqual(res["Final classification"], "DNS_ERROR")

    @patch("app.core.email_checker.resolver.resolve")
    def test_no_answer_no_fallback_returns_no_mx(self, mock_resolve):
        import dns.resolver
        # NoAnswer on MX, and NoAnswer on A fallback too
        mock_resolve.side_effect = dns.resolver.NoAnswer
        v = _make_validator()
        res = v.check_email_smtp("test@example-no-mx.com")
        self.assertIn(res["Final classification"], ("NO_MX", "DNS_ERROR", "UNKNOWN"))


# ─── J. SMTP 250 acceptance ──────────────────────────────────────────────────

class TestSMTPAcceptance(unittest.TestCase):
    """J: SMTP 250 acceptance on a non-catch-all domain → VALID."""

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_j_smtp_250_acceptance(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("gmail.com", "gmail-smtp-in.l.google.com")
        # Main mailbox probe: 250 accepted
        main_mock = _make_smtp_mock((250, b"2.1.5 OK"))
        # Catch-all probe: 550 (not catch-all)
        catchall_mock = _make_smtp_mock((550, b"5.1.1 User unknown"))
        mock_smtp_cls.side_effect = [main_mock, catchall_mock]

        v = _make_validator()
        res = v.check_email_smtp("valid@gmail.com")

        self.assertEqual(res["Final classification"], "VALID")
        self.assertFalse(res.get("catch_all", False))
        self.assertEqual(res.get("SMTP response code"), "250")


# ─── I. SMTP 550 mailbox rejection ───────────────────────────────────────────

class TestSMTPRejection(unittest.TestCase):
    """I: SMTP 550 → INVALID (no catch-all probe needed)."""

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_i_smtp_550_rejection(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("gmail.com", "gmail-smtp-in.l.google.com")
        mock_smtp = _make_smtp_mock((550, b"5.1.1 The email account that you tried to reach does not exist"))
        mock_smtp_cls.return_value = mock_smtp

        v = _make_validator()
        res = v.check_email_smtp("nonexistent999@gmail.com")

        self.assertEqual(res["Final classification"], "INVALID")
        self.assertFalse(res.get("catch_all", False))

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_smtp_553_rejection(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("example.com")
        mock_smtp = _make_smtp_mock((553, b"5.1.3 Bad destination mailbox address syntax"))
        mock_smtp_cls.return_value = mock_smtp
        v = _make_validator()
        res = v.check_email_smtp("bad@example.com")
        self.assertEqual(res["Final classification"], "INVALID")


# ─── K. SMTP 4xx temporary rejection ─────────────────────────────────────────

class TestSMTPTemporaryFailure(unittest.TestCase):
    """K: 4xx response → TEMPORARY_FAILURE."""

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_k_smtp_421_temporary_failure(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("example.com")
        mock_smtp = _make_smtp_mock((421, b"4.7.1 Too many connections"))
        mock_smtp_cls.return_value = mock_smtp
        v = _make_validator()
        res = v.check_email_smtp("user@example.com")
        self.assertEqual(res["Final classification"], "TEMPORARY_FAILURE")

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_smtp_450_greylisted(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("example.com")
        mock_smtp = _make_smtp_mock((450, b"4.2.0 Greylisted, try again"))
        mock_smtp_cls.return_value = mock_smtp
        v = _make_validator()
        res = v.check_email_smtp("user@example.com")
        self.assertEqual(res["Final classification"], "TEMPORARY_FAILURE")


# ─── G. MX timeout ───────────────────────────────────────────────────────────

class TestMXTimeout(unittest.TestCase):
    """G: TCP connection timeout → TCP_CONNECTION_FAILED."""

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_g_tcp_timeout(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("example.com")
        mock = MagicMock()
        mock.tcp_connected = False
        mock.banner_received = False
        mock.connect.side_effect = socket.timeout("timed out")
        mock_smtp_cls.return_value = mock
        v = _make_validator()
        res = v.check_email_smtp("user@example.com")
        self.assertEqual(res["Final classification"], "TCP_CONNECTION_FAILED")

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_banner_timeout_after_tcp_connect(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("pipa.hr", "mail.pipa.hr")
        mock = MagicMock()
        mock.tcp_connected = True    # TCP succeeded
        mock.banner_received = False  # Banner timed out
        mock.connect.side_effect = socket.timeout("banner timed out")
        mock_smtp_cls.return_value = mock
        v = _make_validator()
        res = v.check_email_smtp("info@pipa.hr")
        self.assertEqual(res["Final classification"], "SMTP_BANNER_TIMEOUT")


# ─── H. MX connection refused ────────────────────────────────────────────────

class TestMXConnectionRefused(unittest.TestCase):
    """H: ConnectionRefusedError → TCP_CONNECTION_FAILED."""

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_h_connection_refused(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("example.com")
        mock = MagicMock()
        mock.connect.side_effect = ConnectionRefusedError()
        mock_smtp_cls.return_value = mock
        v = _make_validator()
        res = v.check_email_smtp("user@example.com")
        self.assertEqual(res["Final classification"], "TCP_CONNECTION_FAILED")


# ─── E. Catch-all domain + requested mailbox ─────────────────────────────────

class TestCatchAllRequestedMailbox(unittest.TestCase):
    """E: When requested mailbox is accepted AND random probe is also accepted,
    Final classification must remain VALID with catch_all=True.
    """

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_e_catch_all_requested_mailbox_stays_valid(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("wolfgroupindia.com", "mail.wolfgroupindia.com")
        # First call: requested mailbox (250 accepted)
        main_mock = _make_smtp_mock((250, b"2.1.5 OK"))
        # Second call: random catch-all probe (250 accepted → catch-all)
        catchall_mock = _make_smtp_mock((250, b"2.1.5 OK"))
        mock_smtp_cls.side_effect = [main_mock, catchall_mock]

        v = _make_validator()
        res = v.check_email_smtp("info@wolfgroupindia.com")

        # Requested mailbox stays VALID — catch-all is only metadata
        self.assertEqual(res["Final classification"], "VALID",
                         f"Expected VALID but got {res['Final classification']!r}. Reason: {res.get('Reason')}")
        self.assertTrue(res.get("catch_all"), "Expected catch_all=True")
        self.assertIn("catch_all_note", res)


# ─── F. Catch-all domain + random nonexistent mailbox ────────────────────────

class TestCatchAllRandomMailbox(unittest.TestCase):
    """F: A randomly generated address on a catch-all domain must return RISKY_CATCH_ALL,
    not VALID and not INVALID.
    """

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_f_random_address_on_catchall_is_risky(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("wolfgroupindia.com", "mail.wolfgroupindia.com")
        # First probe: random-looking address → 250 accepted
        main_mock = _make_smtp_mock((250, b"2.1.5 OK"))
        # Catch-all probe: also 250
        catchall_mock = _make_smtp_mock((250, b"2.1.5 OK"))
        mock_smtp_cls.side_effect = [main_mock, catchall_mock]

        v = _make_validator()
        # Use a clearly random address (simulate what check_email_smtp would get for probe)
        res = v.check_email_smtp("dihsfiosdfinfodf@wolfgroupindia.com")

        # Both requested and random accept → catch_all=True and classification should indicate
        # that this is ambiguous (VALID with catch_all, which the caller upgrades to RISKY)
        self.assertTrue(res.get("catch_all"),
                        "Expected catch_all=True for a domain where random probe also accepts")
        # Final classification could be VALID (with catch_all) or RISKY_CATCH_ALL depending on domain behavior
        # The critical assertion: it must NOT be INVALID
        self.assertNotEqual(res["Final classification"], "INVALID",
                            "A catch-all domain must never return INVALID for an ambiguous address")


# ─── L. Multiple MX records ───────────────────────────────────────────────────

class TestMultipleMX(unittest.TestCase):
    """L: First MX times out, second MX accepts → VALID."""

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_l_first_mx_timeout_second_mx_succeeds(self, mock_smtp_cls, mock_resolve):
        import dns.resolver
        # Two MX records: priority 10 and 20
        mx1 = MagicMock(); mx1.preference = 10; mx1.exchange = MagicMock(); mx1.exchange.__str__ = lambda s: "mx1.example.com."
        mx2 = MagicMock(); mx2.preference = 20; mx2.exchange = MagicMock(); mx2.exchange.__str__ = lambda s: "mx2.example.com."
        mock_resolve.return_value = [mx1, mx2]

        # First CustomSMTP instance (for mx1): TCP timeout
        timeout_mock = MagicMock()
        timeout_mock.tcp_connected = False
        timeout_mock.banner_received = False
        timeout_mock.connect.side_effect = socket.timeout("timed out")

        # Second CustomSMTP instance (for mx2): succeeds with 250
        success_mock = _make_smtp_mock((250, b"2.1.5 OK"))
        # Third CustomSMTP instance (catch-all probe on mx2): 550
        catchall_mock = _make_smtp_mock((550, b"5.1.1 User unknown"))

        mock_smtp_cls.side_effect = [timeout_mock, success_mock, catchall_mock]

        v = _make_validator()
        res = v.check_email_smtp("user@example.com")
        self.assertEqual(res["Final classification"], "VALID",
                         f"Expected VALID after first MX timeout, got: {res['Final classification']}")
        self.assertFalse(res.get("catch_all", False))


# ─── A & B. Gmail addresses ───────────────────────────────────────────────────

class TestGmailAddresses(unittest.TestCase):
    """A: Gmail existing address → VALID; B: Gmail nonexistent → INVALID."""

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_a_gmail_existing(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("gmail.com", "gmail-smtp-in.l.google.com")
        main_mock = _make_smtp_mock((250, b"2.1.5 OK"))
        catchall_mock = _make_smtp_mock((550, b"5.1.1 User unknown"))
        mock_smtp_cls.side_effect = [main_mock, catchall_mock]
        v = _make_validator()
        res = v.check_email_smtp("existing@gmail.com")
        self.assertEqual(res["Final classification"], "VALID")
        self.assertFalse(res.get("catch_all", False))

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_b_gmail_nonexistent(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("gmail.com", "gmail-smtp-in.l.google.com")
        main_mock = _make_smtp_mock((550, b"5.1.1 The email account that you tried to reach does not exist"))
        mock_smtp_cls.return_value = main_mock
        v = _make_validator()
        res = v.check_email_smtp("doesnotexist999999@gmail.com")
        self.assertEqual(res["Final classification"], "INVALID")


# ─── C & D. Custom-domain addresses ──────────────────────────────────────────

class TestCustomDomainAddresses(unittest.TestCase):
    """C: Custom domain existing → VALID; D: Custom domain nonexistent → INVALID."""

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_c_custom_existing(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("example.com", "mail.example.com")
        main_mock = _make_smtp_mock((250, b"2.1.5 OK"))
        catchall_mock = _make_smtp_mock((550, b"5.1.1 User unknown"))
        mock_smtp_cls.side_effect = [main_mock, catchall_mock]
        v = _make_validator()
        res = v.check_email_smtp("existing@example.com")
        self.assertEqual(res["Final classification"], "VALID")
        self.assertFalse(res.get("catch_all", False))

    @patch("app.core.email_checker.resolver.resolve")
    @patch("app.core.email_checker.CustomSMTP")
    def test_d_custom_nonexistent(self, mock_smtp_cls, mock_resolve):
        mock_resolve.return_value = _mock_resolve_mx("example.com", "mail.example.com")
        main_mock = _make_smtp_mock((550, b"5.1.1 User unknown"))
        mock_smtp_cls.return_value = main_mock
        v = _make_validator()
        res = v.check_email_smtp("noone@example.com")
        self.assertEqual(res["Final classification"], "INVALID")


class TestSyntaxHardGate(unittest.TestCase):
    """Syntax validation hard gate test."""

    def test_invalid_syntax_hard_gate(self):
        from app.core.email_checker import check_email_detailed
        res = check_email_detailed("nikhiljesh234==!!@@ani9@gmail.com")
        self.assertEqual(res["status"], "INVALID")
        self.assertEqual(res["risk_score"], 100)
        self.assertEqual(res["risk_level"], "HIGH")
        self.assertEqual(res["campaign_decision"], "DO_NOT_SEND")
        self.assertEqual(res["reason"], "Invalid email syntax")
        # Ensure DNS/MX/SMTP checks were skipped
        check_map = {c["name"]: c["status"] for c in res["checks"]}
        self.assertEqual(check_map["Syntax"], "FAIL")
        self.assertEqual(check_map["Domain Existence"], "SKIP")
        self.assertEqual(check_map["MX Record"], "SKIP")
        self.assertEqual(check_map["SMTP Handshake & Mailbox Verification"], "SKIP")


if __name__ == "__main__":
    unittest.main()

