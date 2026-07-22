import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

try:
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='hello'
    )
    print("gemini-2.5-flash success:", response.text)
except Exception as e:
    print("gemini-2.5-flash error:", e)

try:
    response = client.models.generate_content(
        model='gemini-1.5-flash',
        contents='hello'
    )
    print("gemini-1.5-flash success:", response.text)
except Exception as e:
    print("gemini-1.5-flash error:", e)

try:
    response = client.models.generate_content(
        model='gemini-flash-latest',
        contents='hello'
    )
    print("gemini-flash-latest success:", response.text)
except Exception as e:
    print("gemini-flash-latest error:", e)
