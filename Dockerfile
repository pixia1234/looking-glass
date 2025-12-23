FROM node:20-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    iputils-ping \
    mtr-tiny \
    iperf3 \
    ca-certificates \
    curl \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://github.com/nxtrace/NTrace-core/releases/latest/download/nexttrace_linux_amd64 \
  -o /usr/local/bin/nexttrace \
  && chmod +x /usr/local/bin/nexttrace

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend
EXPOSE 3001

CMD ["node", "src/server.js"]
