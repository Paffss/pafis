# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG APP_VERSION=1.1.0
ENV APP_VERSION=$APP_VERSION
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV PAFIS_BASE=/app/data

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/data ./data

EXPOSE 3000
CMD ["npm", "run", "start"]