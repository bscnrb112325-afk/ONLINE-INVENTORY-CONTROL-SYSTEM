import os
import base64
from google import genai
from google.genai import types

api_key = os.environ.get("API_KEY", "YOUR_API_KEY")
client = genai.Client(api_key=api_key)

try:
    response = client.models.generate_content(
        model='gemini-1.5-flash',
        contents=['Hello']
    )
    print('Success gemini-1.5-flash')
except Exception as e:
    print('Error gemini-1.5-flash:', str(e))

try:
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=['Hello']
    )
    print('Success gemini-2.0-flash')
except Exception as e:
    print('Error gemini-2.0-flash:', str(e))
