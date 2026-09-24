import { describe, expect, test, vi } from "vitest";
import { applyFieldErrors } from "./form-errors";
import { ApiError } from "./api";

describe("applyFieldErrors", () => {
  test("pinta solo los campos conocidos por el formulario", () => {
    const setError = vi.fn();
    const error = new ApiError("Revisa los campos marcados.", 400, "VALIDATION_ERROR", {
      title: "Escribe el nombre de la gestión.",
      unknown_field: "Este campo no existe en el formulario.",
    });

    const applied = applyFieldErrors(error, setError, ["title", "estimated_hours"]);

    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith("title", {
      type: "server",
      message: "Escribe el nombre de la gestión.",
    });
  });

  test("devuelve false si el error no es un ApiError", () => {
    const setError = vi.fn();

    const applied = applyFieldErrors(new Error("boom"), setError, ["title"]);

    expect(applied).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  test("devuelve false si no hay campos conocidos en el error", () => {
    const setError = vi.fn();
    const error = new ApiError("Ocurrió un error.", 400, "VALIDATION_ERROR", {
      other_field: "No corresponde a ningún campo del formulario.",
    });

    const applied = applyFieldErrors(error, setError, ["title", "estimated_hours"]);

    expect(applied).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
