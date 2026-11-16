FROM node:20-slim
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
COPY healthcheck.sh ./healthcheck.sh
RUN chmod +x ./healthcheck.sh

# Build production assets and serve with Vite preview
RUN npm run build

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 CMD ["sh", "-c", "./healthcheck.sh"]

EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
