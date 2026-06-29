import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "website",
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 43872,
  },
  build: {
    outDir: "../dist-website",
    emptyOutDir: true,
  },
});
