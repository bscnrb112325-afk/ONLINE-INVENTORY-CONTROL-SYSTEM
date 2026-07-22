FROM python:3.11-slim

# Install Node.js 20
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the entire project
COPY . .

# Install Python dependencies globally in the container
RUN pip install --no-cache-dir -r ai_service/requirements.txt

# Build the frontend and backend Node.js applications
RUN npm run build

# Create a shell script to start both the Python API and the Node server
RUN echo '#!/bin/bash\n\
# 1. Push database schema\n\
npm run db:push --prefix backend\n\
\n\
# 2. Start the Python AI service in the background on port 8000\n\
cd ai_service\n\
uvicorn main:app --host 127.0.0.1 --port 8000 &\n\
cd ..\n\
\n\
# 3. Start the Node.js backend (which binds to the port Sevalla provides)\n\
npm run start --prefix backend\n\
' > start.sh && chmod +x start.sh

# Run the script when the container starts
CMD ["./start.sh"]
