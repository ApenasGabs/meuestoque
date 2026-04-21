import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    open: true,
    host: "0.0.0.0",
    port: 5174,
    hmr: {
      host: "192.168.31.2",
      port: 5174,
    },
  },
});
