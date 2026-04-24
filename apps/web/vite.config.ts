import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND_TARGET = process.env.VITE_BACKEND_PROXY_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": { target: BACKEND_TARGET, changeOrigin: true },
      "/media": { target: BACKEND_TARGET, changeOrigin: true },
      "/health": { target: BACKEND_TARGET, changeOrigin: true },
    },
  },
});
