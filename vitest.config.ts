import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./tests/setup-env.ts"],
    // Los tests de integration comparten una única instancia real de
    // Postgres local (Supabase). Correr los archivos en paralelo satura
    // las conexiones y produce fallas intermitentes en escrituras
    // individuales (ej. un upsert de un lote de 25 filas) sin que haya
    // ningún bug de lógica — no es flakiness real, es contención de
    // recursos. Se descubrió mientras se investigaba un flake intermitente
    // en tests/integration/run-analyze.test.ts (Loop 4).
    fileParallelism: false,
  },
});
