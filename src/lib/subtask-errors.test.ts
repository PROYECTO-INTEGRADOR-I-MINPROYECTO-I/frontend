import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "./api";
import { describeSaveError } from "./subtask-errors";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("describeSaveError", () => {
  test("NETWORK_ERROR: sin conexión", () => {
    const error = new ApiError("No pudimos conectar con el servidor.", 0, "NETWORK_ERROR");
    expect(describeSaveError(error)).toBe("Sin conexión. No se guardó el cambio.");
  });

  test("navigator.onLine === false: sin conexión, aunque el código del error sea otro", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const error = new ApiError("Algo salió mal.", 500, "SERVER_ERROR");
    expect(describeSaveError(error)).toBe("Sin conexión. No se guardó el cambio.");
  });

  test("5xx: el servidor no respondió", () => {
    const error = new ApiError("Ocurrió un error en el servidor.", 500, "SERVER_ERROR");
    expect(describeSaveError(error)).toBe("El servidor no respondió. No se guardó el cambio.");
  });

  test("404: la acción no está disponible en el servidor", () => {
    const error = new ApiError("No encontramos lo que buscabas.", 404, "NOT_FOUND");
    expect(describeSaveError(error)).toBe("Esta acción todavía no está disponible en el servidor.");
  });

  test("otros casos: usa el message del ApiError", () => {
    const error = new ApiError("Revisa los campos marcados.", 400, "VALIDATION_ERROR");
    expect(describeSaveError(error)).toBe("Revisa los campos marcados.");
  });

  test("un error que no es ApiError cae en el mensaje genérico", () => {
    expect(describeSaveError(new Error("boom"))).toBe("Ocurrió un error inesperado. Intenta de nuevo.");
  });
});
