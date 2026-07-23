#!/bin/bash
# 1. Push database schema
npm run db:push --prefix backend

# 2. Start the Python AI service in the background on port 18000
cd ai_service
python -m uvicorn main:app --host 0.0.0.0 --port 18000 &
cd ..

# 3. Start the Node.js backend (which binds to the port Sevalla provides)
npm run start --prefix backend
