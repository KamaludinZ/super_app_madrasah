# ── Stage 1: Build React ─────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Salin dependency files terlebih dahulu agar layer di-cache
COPY package*.json ./

# Install dependencies (--legacy-peer-deps diperlukan untuk React 19 + beberapa paket)
RUN npm ci --legacy-peer-deps

COPY . .

# Build production
RUN npm run build

# ── Stage 2: Serve dengan Nginx ──────────────────────────────
FROM nginx:1.27-alpine

# Salin hasil build React
COPY --from=builder /app/build /usr/share/nginx/html

# Salin konfigurasi nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
