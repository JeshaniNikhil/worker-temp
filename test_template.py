import httpx
import asyncio

async def test():
    async with httpx.AsyncClient() as client:
        payload = {
            "name": "Test Template",
            "subject": "Hello",
            "body_html": "",
            "body_text": "Hello world",
            "variables": []
        }
        res = await client.post("http://localhost:8001/api/templates/", json=payload)
        print("Status Code:", res.status_code)
        print("Response:", res.text)

if __name__ == "__main__":
    asyncio.run(test())
