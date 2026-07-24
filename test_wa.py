import httpx
import asyncio
import os
from dotenv import load_dotenv

load_dotenv('ai_service/.env')

async def test():
    phone_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID')
    token = os.getenv('WHATSAPP_ACCESS_TOKEN')
    
    url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": "254784245900",
        "type": "text",
        "text": {"body": "test message", "preview_url": False},
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload, timeout=15.0)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")

asyncio.run(test())
