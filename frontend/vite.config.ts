import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  
  return {
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    server: {
      host: '0.0.0.0', // Allow external connections
      port: 5173,
      proxy: {
        "/gamehub": {
          target: isDev ? "http://localhost:5062" : "http://host.docker.internal:5062",
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
