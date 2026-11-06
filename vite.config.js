import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Required so the proxied Arena preview host is accepted.
    allowedHosts: true,
    // The sandbox preview is proxied through HTTPS on another host, so the
    // default HMR socket cannot reliably attach. Disable it for clean consoles;
    // re-enable locally if you prefer hot reload.
    hmr: false,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
