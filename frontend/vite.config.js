import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const proxy = {
    "/api": {
      target: env.WMS_BRIDGE_TARGET || "http://127.0.0.1:8000",
      changeOrigin: true,
      timeout: 40000,
      proxyTimeout: 40000,
    },
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    server: {
      port: 5173,
      strictPort: true,
      proxy,
    },

    preview: {
      port: 5173,
      strictPort: true,
      proxy,
    },
  };
});