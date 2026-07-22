import os
from google import genai

api_key = os.environ.get("API_KEY", "YOUR_API_KEY")
try:
    client = genai.Client(api_key=api_key)
    for model in client.models.list():
        print(model.name)
except Exception as e:
    print("Error:", e)
