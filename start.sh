#!/bin/bash
set -e

echo "Starting deployment script..."

# 1. Start the Python AI service in the background on port 18000
echo "Starting AI service..."
cd ai_service
if [ -d "/app/.venv" ]; then
    /app/.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 18000 &
else
    python3 -m uvicorn main:app --host 0.0.0.0 --port 18000 &
fi
cd ..

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
