import os
from google import genai

api_key = os.environ.get("API_KEY", "YOUR_API_KEY")
try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='hello'
    )
    print("Success:", response.text)
except Exception as e:
    print("Error:", e)
