import { defineConfig } from "vite";
// Vite never reads local .env files; server secrets cannot enter the client bundle.
export default defineConfig({
  envDir: false,
  root: "client",
  publicDir: "../public",
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    port: 3000,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
  },
});
