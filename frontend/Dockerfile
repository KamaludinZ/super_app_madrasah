# ── Stage 1: Build React ─────────────────────────────────────
# Node 22 LTS (dapat patch keamanan; Node 18/20 sudah EOL). Hanya dipakai saat build.
FROM node:22-alpine AS builder

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

# Skrip start: pecah BACKEND_UPSTREAM untuk proxy ber-resolver (nginx tetap hidup walau backend belum siap) dan
# listen IPv6 otomatis bila tersedia (healthcheck ke "localhost" yang di-resolve ke ::1 tetap berhasil).
COPY --chmod=755 docker/15-superapp-upstream.envsh docker/30-superapp-listen-ipv6.sh /docker-entrypoint.d/

# Default upstream untuk backend (WAJIB dioverride di Coolify env frontend)
# Contoh: http://backend:8000/api/ (satu stack compose) atau https://api.domain-anda.com/api/
ENV BACKEND_UPSTREAM=http://127.0.0.1:65535/api/

EXPOSE 80

# Healthcheck: dipakai docker compose & Coolify. Memakai 127.0.0.1 (bukan localhost) agar tidak tersesat ke ::1, dan
# wget bawaan image alpine (busybox). /healthz tidak bergantung pada backend.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
