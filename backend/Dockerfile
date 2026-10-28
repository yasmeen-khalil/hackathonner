# Hackathonner API: Python 3.12 + Node (for the One CLI). Build context is the backend/ folder.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y --no-install-recommends nodejs && \
    npm i -g @withone/cli && apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8000 CREWAI_DISABLE_TELEMETRY=true OTEL_SDK_DISABLED=true
EXPOSE 8000
CMD ["sh", "start.sh"]
