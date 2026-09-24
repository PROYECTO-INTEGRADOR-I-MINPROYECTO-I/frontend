import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest no expone `afterEach` como global (test.globals no está activado en
// vite.config.ts), así que el cleanup automático de Testing Library no se
// registra solo: hay que engancharlo a mano para que cada test desmonte lo
// que montó el anterior.
afterEach(() => {
  cleanup();
});