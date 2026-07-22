FROM python:3.11-slim

# Install Node.js 20 and build tools
RUN apt-get update && apt-get install -y curl build-essential \
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

# Make sure start.sh is executable and has linux line endings
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

# Run the script when the container starts
CMD ["./start.sh"]
