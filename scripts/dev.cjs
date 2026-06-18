const path = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const preferredPort = Number.parseInt(process.env.GOCUS_DEV_PORT ?? "43871", 10);

async function main() {
  const { createServer } = await import("vite");
  const electronPath = require("electron");
  const server = await createServer({
    configFile: path.join(projectRoot, "vite.config.ts"),
    root: projectRoot,
    server: {
      host: "127.0.0.1",
      port: Number.isFinite(preferredPort) ? preferredPort : 43871,
      strictPort: false,
    },
  });

  await server.listen();
  server.printUrls();

  const address = server.httpServer?.address();
  const actualPort = typeof address === "object" && address ? address.port : server.config.server.port;
  const devServerUrl = `http://127.0.0.1:${actualPort}`;

  const electron = spawn(electronPath, ["."], {
    cwd: projectRoot,
    env: {
      ...process.env,
      GOCUS_DEV_SERVER_URL: devServerUrl,
    },
    stdio: "inherit",
  });

  const shutdown = async (exitCode = 0) => {
    electron.kill();
    await server.close();
    process.exit(exitCode);
  };

  electron.on("exit", (code) => {
    shutdown(code ?? 0);
  });

  process.on("SIGINT", () => {
    shutdown(0);
  });
  process.on("SIGTERM", () => {
    shutdown(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
