# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Disable TLS verification for self-signed certs in private clusters
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public

# Mount your manifest data at /data, or set PAFIS_BASE to another path
# docker run -v /path/to/your/manifests:/data pafis:latest
ENV PAFIS_BASE=/data

EXPOSE 3000
CMD ["npm", "run", "start"]
