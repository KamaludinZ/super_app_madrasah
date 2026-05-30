# Multi-stage Dockerfile for Super Apps MATSANDATAMA
# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies with legacy peer deps to handle React 19
RUN npm install --legacy-peer-deps --verbose

# Copy frontend source
COPY frontend/ .

# Build frontend
RUN npm run build

# Stage 2: Build Backend
FROM python:3.11-slim AS backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir dnspython

# Copy backend source
COPY backend/ .

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/build /app/static

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Start server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
