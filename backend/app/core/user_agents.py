import random

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Twitterbot/1.0",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Jakarta Commons-HttpClient/3.1)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "TelegramBot (like TwitterBot)",
    "WhatsApp/2.21.19.21 A",
    "Discordbot/2.0"
]

def get_random_user_agent():
    return random.choice(USER_AGENTS)

def get_standard_user_agents():
    return [ua for ua in USER_AGENTS if "bot" not in ua.lower() and "facebookexternalhit" not in ua.lower()]

def get_bot_user_agents():
    return [ua for ua in USER_AGENTS if "bot" in ua.lower() or "facebookexternalhit" in ua.lower()]

def get_social_bot_user_agents():
    # Returns bots that are highly trusted for link unfurling by rigid platforms like LinkedIn
    return [
        "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
        "TelegramBot (like TwitterBot)",
        "WhatsApp/2.21.19.21 A",
        "Discordbot/2.0"
    ]
