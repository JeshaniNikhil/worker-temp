import httpx

url_valid = "https://www.linkedin.com/in/nikhil-jesani/"
uas = [
    "TelegramBot (like TwitterBot)",
    "WhatsApp/2.21.19.21 A",
    "Discordbot/2.0",
    "Applebot/0.1.2"
]

for ua in uas:
    try:
        resp1 = httpx.get(url_valid, headers={"User-Agent": ua}, follow_redirects=True, timeout=5)
        print(f"UA: {ua} - Status: {resp1.status_code}")
    except Exception as e:
        print(e)

