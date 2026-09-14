import httpx

url_valid = "https://www.linkedin.com/in/nikhil-jesani/"
url_invalid = "https://www.linkedin.com/in/this-profile-should-not-exist-1234567890/"
ua = "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"

print("Valid:")
resp1 = httpx.get(url_valid, headers={"User-Agent": ua}, follow_redirects=True, timeout=5)
print(resp1.status_code)
if resp1.status_code == 200:
    print(resp1.text[:200])

print("\nInvalid:")
resp2 = httpx.get(url_invalid, headers={"User-Agent": ua}, follow_redirects=True, timeout=5)
print(resp2.status_code)
if resp2.status_code == 200:
    print(resp2.text[:200])
