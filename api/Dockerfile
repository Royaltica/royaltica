# ─── Stage 1: build ────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Alpine no trae OpenSSL por default. Prisma necesita el binario `openssl`
# real (no solo libcrypto de Node) para detectar la versión correcta y
# generar/cargar el engine adecuado. Sin esto, Prisma cae al default
# hardcodeado "openssl-1.1.x", que ya no existe en imágenes node:20-alpine
# recientes (traen OpenSSL 3) -> PrismaClientInitializationError en runtime.
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ─── Stage 2: production ───────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Mismo motivo que en el stage de build: esta etapa corre su propio
# `prisma generate` (necesita el engine dentro de node_modules, que no se
# copia desde el builder), así que también necesita openssl instalado.
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Cloud Run inyecta PORT; el server escucha en 0.0.0.0:$PORT
EXPOSE 8080
# nest build compila a dist/src/main.js (ver tsconfig.json: include abarca
# src/ y prisma/, así que TS infiere la raíz del proyecto como rootDir).
# package.json ya tenía el script "start:prod" apuntando bien; el Dockerfile
# se había quedado con la ruta vieja "dist/main.js" y por eso el contenedor
# crasheaba en producción con MODULE_NOT_FOUND.
CMD ["npm", "run", "start:prod"]
