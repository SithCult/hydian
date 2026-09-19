import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Tauri sets TAURI_ENV_PLATFORM in dev/build; the browser dev flow proxies
// /bridge/* to the Node dev bridge (read-only file access to the SWTOR folders).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: { "/bridge": { target: "http://127.0.0.1:8790", changeOrigin: true } },
  },
  // public/ may hold the map artwork (155 MB, not in git). Production builds load it from the hosted tiles service
  // (src/data/maps.ts ASSET_BASE), so it is not copied into the bundle unless VITE_ASSET_BASE says otherwise.
  build: { target: "es2022", sourcemap: false, copyPublicDir: process.env.VITE_ASSET_BASE === "/" },
});
