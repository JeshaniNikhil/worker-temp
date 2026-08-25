import sys
import os
import unittest
from unittest.mock import patch, MagicMock

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.core.email_checker import SMTPValidator

class TestSMTPValidator(unittest.TestCase):
    
    def setUp(self):
        self.validator = SMTPValidator(connect_timeout=1.0, banner_timeout=1.0, command_timeout=1.0)
        
    @patch('app.core.email_checker.resolver.resolve')
    def test_dns_nxdomain(self, mock_resolve):
        import dns.resolver
        mock_resolve.side_effect = dns.resolver.NXDOMAIN
        
        res = self.validator.check_email_smtp("test@notrealdomain.xyz123")
        self.assertEqual(res["Final classification"], "DNS_ERROR")
        
    @patch('app.core.email_checker.resolver.resolve')
    @patch('app.core.email_checker.CustomSMTP')
    def test_smtp_accepted(self, mock_smtp, mock_resolve):
        # Mock DNS
        mock_answer = MagicMock()
        mock_answer.preference = 10
        mock_answer.exchange = "mail.example.com."
        mock_resolve.return_value = [mock_answer]
        
        # Mock SMTP
        mock_server = MagicMock()
        mock_server.helo.return_value = (250, b'example.com')
        # docmd side_effect returns different tuples based on call order
        # MAIL FROM, then RCPT TO
        mock_server.docmd.side_effect = [
            (250, b'2.1.0 Sender OK'),
            (250, b'2.1.5 Recipient OK')
        ]
        mock_smtp.return_value = mock_server
        
        # When checking for catch-all, we return 550 to NOT make it a catch-all
        with patch.object(self.validator, '_probe_mx') as mock_probe:
            # First probe returns ACCEPTED
            mock_probe.return_value = {
                "Final classification": "VALID",
                "Selected MX": "mail.example.com",
            }
            # Catch-all probe returns INVALID
            mock_probe.side_effect = [
                {"Final classification": "VALID", "Selected MX": "mail.example.com"},
                {"Final classification": "INVALID"}
            ]
            
            res = self.validator.check_email_smtp("valid@example.com")
            self.assertEqual(res["Final classification"], "VALID")

    @patch('app.core.email_checker.resolver.resolve')
    @patch('app.core.email_checker.CustomSMTP')
    def test_smtp_invalid(self, mock_smtp, mock_resolve):
        mock_answer = MagicMock()
        mock_answer.preference = 10
        mock_answer.exchange = "mail.example.com."
        mock_resolve.return_value = [mock_answer]
        
        mock_server = MagicMock()
        mock_server.helo.return_value = (250, b'example.com')
        mock_server.docmd.side_effect = [
            (250, b'2.1.0 Sender OK'),
            (550, b'5.1.1 User unknown')
        ]
        mock_smtp.return_value = mock_server
        
        res = self.validator.check_email_smtp("invalid@example.com")
        self.assertEqual(res["Final classification"], "INVALID")
        
    @patch('app.core.email_checker.resolver.resolve')
    @patch('app.core.email_checker.CustomSMTP')
    def test_smtp_temporary_failure(self, mock_smtp, mock_resolve):
        mock_answer = MagicMock()
        mock_answer.preference = 10
        mock_answer.exchange = "mail.example.com."
        mock_resolve.return_value = [mock_answer]
        
        mock_server = MagicMock()
        mock_server.helo.return_value = (250, b'example.com')
        mock_server.docmd.side_effect = [
            (250, b'2.1.0 Sender OK'),
            (421, b'4.7.1 Service unavailable - try again later')
        ]
        mock_smtp.return_value = mock_server
        
        res = self.validator.check_email_smtp("temp@example.com")
        self.assertEqual(res["Final classification"], "TEMPORARY_FAILURE")
        
    @patch('app.core.email_checker.resolver.resolve')
    @patch('app.core.email_checker.CustomSMTP')
    def test_catch_all(self, mock_smtp, mock_resolve):
        mock_answer = MagicMock()
        mock_answer.preference = 10
        mock_answer.exchange = "mail.example.com."
        mock_resolve.return_value = [mock_answer]
        
        # When probing, both real and random return VALID
        with patch.object(self.validator, '_probe_mx') as mock_probe:
            mock_probe.side_effect = [
                {"Final classification": "VALID", "Selected MX": "mail.example.com"},
                {"Final classification": "VALID"}
            ]
            
            res = self.validator.check_email_smtp("valid@example.com")
            self.assertEqual(res["Final classification"], "CATCH_ALL")

    @patch('app.core.email_checker.resolver.resolve')
    @patch('app.core.email_checker.CustomSMTP')
    def test_tcp_timeout(self, mock_smtp, mock_resolve):
        mock_answer = MagicMock()
        mock_answer.preference = 10
        mock_answer.exchange = "mail.example.com."
        mock_resolve.return_value = [mock_answer]
        
        import socket
        mock_server = MagicMock()
        mock_server.connect.side_effect = socket.timeout("timed out")
        mock_server.tcp_connected = False
        mock_smtp.return_value = mock_server
        
        res = self.validator.check_email_smtp("timeout@example.com")
        self.assertEqual(res["Final classification"], "TCP_CONNECTION_FAILED")

    @patch('app.core.email_checker.resolver.resolve')
    @patch('app.core.email_checker.CustomSMTP')
    def test_banner_timeout(self, mock_smtp, mock_resolve):
        mock_answer = MagicMock()
        mock_answer.preference = 10
        mock_answer.exchange = "mail.example.com."
        mock_resolve.return_value = [mock_answer]
        
        import socket
        mock_server = MagicMock()
        mock_server.connect.side_effect = socket.timeout("timed out")
        mock_server.tcp_connected = True
        mock_server.banner_received = False
        mock_smtp.return_value = mock_server
        
        res = self.validator.check_email_smtp("bannertimeout@example.com")
        self.assertEqual(res["Final classification"], "SMTP_BANNER_TIMEOUT")

    @patch('app.core.email_checker.resolver.resolve')
    @patch('app.core.email_checker.CustomSMTP')
    def test_tcp_refused(self, mock_smtp, mock_resolve):
        mock_answer = MagicMock()
        mock_answer.preference = 10
        mock_answer.exchange = "mail.example.com."
        mock_resolve.return_value = [mock_answer]
        
        mock_server = MagicMock()
        mock_server.connect.side_effect = ConnectionRefusedError("refused")
        mock_smtp.return_value = mock_server
        
        res = self.validator.check_email_smtp("refused@example.com")
        self.assertEqual(res["Final classification"], "TCP_CONNECTION_FAILED")

    @patch('app.core.email_checker.resolver.resolve')
    @patch('app.core.email_checker.CustomSMTP')
    def test_bind_error(self, mock_smtp, mock_resolve):
        mock_answer = MagicMock()
        mock_answer.preference = 10
        mock_answer.exchange = "mail.example.com."
        mock_resolve.return_value = [mock_answer]
        
        import socket
        err = socket.error("bind failed")
        mock_server = MagicMock()
        mock_server.connect.side_effect = err
        mock_server.bind_error = err
        mock_smtp.return_value = mock_server
        
        res = self.validator.check_email_smtp("bind@example.com")
        self.assertEqual(res["Final classification"], "SOURCE_IP_BIND_ERROR")

if __name__ == "__main__":
    unittest.main()
