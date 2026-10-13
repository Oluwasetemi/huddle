import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": "http://localhost:4444",
      "/channels": "http://localhost:4444",
      "/ws": {
        target: "ws://localhost:4444",
        ws: true,
      },
    },
  },
});
