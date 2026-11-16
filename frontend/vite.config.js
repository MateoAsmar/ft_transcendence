import { defineConfig } from "vite";

// Determine backend origin: allow overriding via VITE_BACKEND_ORIGIN env var.
// When running outside Docker, 'backend' hostname is unknown so fallback to localhost.
const backendOrigin =
  process.env.VITE_BACKEND_ORIGIN ||
  (process.env.DOCKER ? "http://backend:8000" : "http://localhost:8000");

// Dev server port handling: allow override, be strict only in Docker
const devPort = Number(process.env.VITE_PORT) || 5173;
const strict =
  Boolean(process.env.DOCKER) || process.env.STRICT_PORT === "true";

export default defineConfig({
  appType: "spa",
  server: {
    host: "0.0.0.0",
    port: devPort,
    strictPort: strict,
    proxy: {
      "/api": { target: backendOrigin, changeOrigin: true, secure: false },
      "/socket.io": { target: backendOrigin, ws: true, changeOrigin: true },
    },
    allowedHosts: true,
  },
});
