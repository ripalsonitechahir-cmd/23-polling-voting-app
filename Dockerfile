# syntax=docker/dockerfile:1

# ---- Stage 1: build the React front end ----
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: install backend deps and generate the Prisma client ----
FROM node:20-bookworm-slim AS backend-build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate

# ---- Stage 3: runtime image ----
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates util-linux && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/polls.db
WORKDIR /app/backend
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY backend/package*.json ./
COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
RUN chmod +x docker-entrypoint.sh && mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
