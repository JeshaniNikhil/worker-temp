import httpx
import re

url = "https://www.instagram.com/rajkot_estate_broker/"
uas = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "TelegramBot (like TwitterBot)",
    "WhatsApp/2.21.19.21 A",
    "Discordbot/2.0",
    "Instagram 219.0.0.12.117 Android"
]

for ua in uas:
    try:
        resp = httpx.get(url, headers={"User-Agent": ua}, follow_redirects=True, timeout=5)
        print(f"UA: {ua[:25]} - Status: {resp.status_code}")
        
        t_match = re.search(r"<title>([^<]*)</title>", resp.text, re.IGNORECASE)
        title = t_match.group(1).strip() if t_match else ""
        print(f"  Title: {title}")
        
        if "instagram" in title.lower() and title.lower() != "instagram":
            pass
            
    except Exception as e:
        print(f"UA: {ua[:25]} - Error: {e}")

