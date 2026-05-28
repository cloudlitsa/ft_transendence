import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // When the browser asks for /api/*, Vite forwards it to the backend
    // container. "backend" is the service name from docker-compose, which
    // Docker resolves to the backend container's address on the internal
    // network. This is why the frontend doesn't need to know an IP.
    proxy: {
      "/api": {
        target: "http://backend:3000",
        changeOrigin: true,
      },
    },
  },
});
