import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    hmr: {
      overlay: false,
    },
    watch: {
      ignored: ['**/reports/**', '**/test-results/**', '**/tests/**', '**/.git/**'],
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    proxy: {
      "/api": {
        target: "http://localhost:5177",
        changeOrigin: true,
      },
    },
  },
});
