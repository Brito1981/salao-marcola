import { defineConfig } from "vite";

export default defineConfig({
  // raiz do projeto = onde está o index.html
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});
