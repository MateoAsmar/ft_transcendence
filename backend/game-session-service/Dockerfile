FROM node:20-alpine AS builder
WORKDIR /app

COPY backend/game-session-service/package.json ./package.json
COPY backend/game-session-service/tsconfig.json ./tsconfig.json
COPY backend/protos ./protos
COPY backend/game-session-service/healthcheck.sh ./healthcheck.sh

RUN npm install

COPY backend/game-session-service/src ./src

RUN npm run build
RUN chmod +x ./healthcheck.sh

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/package.json .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/protos ./protos
COPY --from=builder /app/healthcheck.sh ./healthcheck.sh
RUN chmod +x ./healthcheck.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 CMD ["sh", "-c", "/app/healthcheck.sh"]

EXPOSE 4002 50054
CMD ["node", "dist/index.js"]

