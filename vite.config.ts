import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createDevWebBridgePlugin } = require("./electron/lib/devWebBridge.cjs");

export default defineConfig({
  base: "./",
  plugins: [react(), createDevWebBridgePlugin(process.cwd())],
  server: {
    host: "127.0.0.1",
    port: 43871,
  },
});
