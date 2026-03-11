import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@components": path.resolve(__dirname, "src/components"),
      "@constants": path.resolve(__dirname, "src/features/plants/constants"),
      "@contracts": path.resolve(__dirname, "../../packages/contracts/src"),
      "@shared": path.resolve(__dirname, "../../packages/shared-logic/src"),
      "@scoring": path.resolve(__dirname, "../../packages/scoring/src"),
      "@lib": path.resolve(__dirname, "src/lib"),
      "@store": path.resolve(__dirname, "src/store"),
      "@features/ai": path.resolve(__dirname, "src/features/ai"),
      "@features/simulations": path.resolve(__dirname, "src/features/simulations")
    }
  },
  server: {
    port: 5175
  }
});