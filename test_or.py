import os
import httpx

api_key = os.environ.get("API_KEY", "YOUR_API_KEY")
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "OICS"
}

payload = {
    "model": "google/gemini-2.0-flash-001",
    "messages": [
        {
            "role": "user",
            "content": "Respond with {'status': 'ok'} as json."
        }
    ]
}

try:
    with httpx.Client() as client:
        resp = client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
        print(resp.status_code)
        print(resp.text)
except Exception as e:
    print("Error:", e)
