# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Flask app + compiled React assets
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend

# Copy built React frontend static assets
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 5000

# Set working directory to backend
WORKDIR /app/backend

# Environment variables
ENV FLASK_ENV=production
ENV PORT=5000
ENV DATABASE_PATH=/app/backend/data/database.db
ENV UPLOAD_FOLDER=/app/backend/data/uploads
ENV SECRET_KEY=richa_sharma_prod_secret_key_10293

# Run server with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
