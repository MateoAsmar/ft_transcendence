FROM node:20-alpine AS builder
WORKDIR /app

COPY backend/api-gateway/package.json ./package.json
COPY backend/api-gateway/tsconfig.json ./tsconfig.json
COPY backend/protos ./protos
COPY backend/api-gateway/healthcheck.sh ./healthcheck.sh

RUN npm install

COPY backend/api-gateway/src ./src

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 CMD ["sh", "-c", "/app/healthcheck.sh"]

EXPOSE 8000
CMD ["node", "dist/index.js"]
