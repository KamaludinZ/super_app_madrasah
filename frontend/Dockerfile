# ── Stage 1: Build React ─────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Salin dependency files terlebih dahulu agar layer di-cache
COPY package*.json ./

# Install dependencies dengan retry/timeouts yang lebih aman untuk environment build server
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm install --legacy-peer-deps

COPY . .

# Accept build arguments for React environment variables
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}

# Build production
RUN npm run build

# ── Stage 2: Serve dengan Nginx ──────────────────────────────
FROM nginx:1.27-alpine

# Salin hasil build React
COPY --from=builder /app/build /usr/share/nginx/html

# Salin konfigurasi nginx template (akan di-render dengan envsubst saat container start)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Default upstream untuk backend (WAJIB dioverride di Coolify env frontend)
# Contoh: https://api.domain-anda.com/api/
ENV BACKEND_UPSTREAM=http://127.0.0.1:65535/api/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
