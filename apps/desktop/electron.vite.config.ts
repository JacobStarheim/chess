import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
      lib: {
        entry: resolve(__dirname, "electron/main.ts")
      }
    },
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "shared")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      lib: {
        entry: resolve(__dirname, "electron/preload.ts")
      }
    },
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "shared")
      }
    }
  },
  renderer: {
    root: __dirname,
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        "@shared": resolve(__dirname, "shared")
      }
    },
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: resolve(__dirname, "index.html")
      }
    }
  }
});
