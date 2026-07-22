#!/bin/bash
# 1. Push database schema
npm run db:push --prefix backend

# 2. Start the Python AI service in the background on port 8000
cd ai_service
uvicorn main:app --host 127.0.0.1 --port 8000 &
cd ..

# 3. Start the Node.js backend (which binds to the port Sevalla provides)
npm run start --prefix backend
