#!/bin/bash
set -e

echo "Starting deployment script..."

# 1. Start the Python AI service in the background on port 8000
echo "Starting AI service..."
cd ai_service

# Guarantee Python requirements are installed in runtime environment
if command -v python3 >/dev/null 2>&1; then
    python3 -m pip install --no-cache-dir -r requirements.txt || true
    python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > uvicorn.log 2>&1 &
elif command -v python >/dev/null 2>&1; then
    python -m pip install --no-cache-dir -r requirements.txt || true
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 > uvicorn.log 2>&1 &
elif [ -f "/app/.venv/bin/python" ]; then
    /app/.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 > uvicorn.log 2>&1 &
elif [ -f ".venv/bin/python" ]; then
    .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 > uvicorn.log 2>&1 &
else
    echo "ERROR: No python executable found!"
fi
cd ..
sleep 3

if [ -f "ai_service/uvicorn.log" ]; then
    echo "--- Uvicorn Startup Log ---"
    cat ai_service/uvicorn.log
    echo "---------------------------"
fi

# 2. Run custom migrations (avoids interactive prompts that cause drizzle-kit to hang)
echo "Running database migrations..."
if [ -f "backend/dist/runMigration.js" ]; then
    node backend/dist/runMigration.js || echo "Custom migration failed, continuing..."
else
    npx tsx backend/src/runMigration.ts || echo "Custom migration failed, continuing..."
fi

# 3. Start the Node.js backend using 'exec' so it correctly replaces the shell process
# This ensures Sevalla can properly track its health, keep PID 1 alive, and monitor exit codes.
echo "Starting Node.js backend..."
exec npm run start --prefix backend

