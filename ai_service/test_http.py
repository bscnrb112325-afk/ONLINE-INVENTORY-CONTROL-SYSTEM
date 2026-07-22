import urllib.request
import json

data = json.dumps({"image_base64": "test"}).encode('utf-8')
req = urllib.request.Request("http://127.0.0.1:8000/vision/recognize", data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print(e)
