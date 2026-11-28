# COMMUNITY 360 · un solo servicio: la API FastAPI sirve también el build del frontend.
# Las credenciales llegan como variables de entorno de Render; nunca se copian a la imagen.

# --- Etapa 1: construir el frontend (React + Vite) ---------------------------------------
FROM node:24-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Etapa 2: la API (Python 3.13) ---------------------------------------------------------
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
# Mismo lugar relativo que en el repo: la API lo busca en ../frontend/dist
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Sin permisos de root
RUN useradd --create-home --uid 1000 c360
USER c360

EXPOSE 8000
# Render asigna $PORT. Un solo proceso: los tokens revocados viven en memoria.
# --proxy-headers: Render termina el https y avisa con X-Forwarded-Proto
CMD ["sh", "-c", "exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips '*'"]
