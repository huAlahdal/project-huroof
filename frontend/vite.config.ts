import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  return {
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    server: {
      host: '0.0.0.0', // Allow external connections
      port: 5173,
      // Dev-only proxy: forwards /api and /gamehub to the backend running on port 5062
      proxy: {
        "/api": {
          target: "http://localhost:5062",
          changeOrigin: true,
        },
        "/gamehub": {
          target: "http://localhost:5062",
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
