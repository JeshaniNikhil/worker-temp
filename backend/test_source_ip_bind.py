import os
import sys
import socket

# Try importing CustomSMTP from backend/app/core/email_checker
try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from app.core.email_checker import CustomSMTP
except ImportError:
    import smtplib
    class CustomSMTP(smtplib.SMTP):
        def __init__(self, **kwargs):
            self.source_ip = None
            super().__init__(**kwargs)

def test_bind():
    target_ip = os.environ.get("SMTP_SOURCE_IP", "169.58.234.98").strip()
    print("Testing SMTP Source IP Binding...")
    print(f"Target Source IP: {target_ip}")
    
    server = CustomSMTP()
    if target_ip and ":" not in target_ip:
        server.source_address = (target_ip, 0)
        print(f"Configured server.source_address = {server.source_address}")
        
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if server.source_address:
            try:
                sock.bind(server.source_address)
                bound_ip, bound_port = sock.getsockname()
                print(f"SUCCESS: Socket successfully bound to local IP: {bound_ip} (port: {bound_port})")
            except socket.error as e:
                print(f"NOTICE: Socket bind to {target_ip} returned: {e}")
                print("If running on local dev machine without this IP configured, this is expected.")
                print("On Contabo server with 169.58.234.98/32 on eth0, this succeeds cleanly.")
        sock.close()
    except Exception as e:
        print(f"Error during socket bind test: {e}")

if __name__ == "__main__":
    test_bind()
