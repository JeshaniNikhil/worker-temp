import httpx
import re

url = "https://www.instagram.com/this_profile_does_not_exist_1234567890/"
ua = "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"

try:
    resp = httpx.get(url, headers={"User-Agent": ua}, follow_redirects=True, timeout=5)
    print(f"Status: {resp.status_code}")
    
    t_match = re.search(r"<title>([^<]*)</title>", resp.text, re.IGNORECASE)
    title = t_match.group(1).strip() if t_match else ""
    print(f"Title: {title}")
except Exception as e:
    print(f"Error: {e}")

