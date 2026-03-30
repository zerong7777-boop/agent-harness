import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "app"),
  base: "/gui/",
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4173",
      "/indexes": "http://127.0.0.1:4173",
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
  },
});
