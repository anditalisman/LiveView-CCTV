import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend port bisa di-override (mis. saat port 4000 default sudah dipakai proses lain
// di mesin dev), tanpa perlu mengubah file ini: VITE_BACKEND_PORT=4010 npm run dev
const backendUrl = `http://localhost:${process.env.VITE_BACKEND_PORT || 4000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": backendUrl,
      "/streams": backendUrl,
      "/socket.io": { target: backendUrl, ws: true },
    },
  },
});
