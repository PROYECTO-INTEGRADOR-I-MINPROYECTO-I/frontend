import { afterEach, describe, expect, test, vi } from "vitest";
import { apiFetch, ApiError, createSubtask, setUnauthorizedHandler } from "./api";
import type { CreateSubtaskPayload } from "./types";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  test("200 devuelve el cuerpo ya parseado como JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ eid: 1, name: "Boda" }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<{ eid: number; name: string }>("/eventos/1/");

    expect(result).toEqual({ eid: 1, name: "Boda" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/eventos/1/",
      expect.objectContaining({ credentials: "include" })
    );
  });

  test("400 con errores de campo lanza ApiError con fields y código VALIDATION_ERROR", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ estimated_hours: ["Las horas estimadas deben ser mayores a 0."] }, 400)
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/eventos/1/subtareas/", { method: "POST" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
      fields: { estimated_hours: "Las horas estimadas deben ser mayores a 0." },
    });
  });

  test("404 sin cuerpo usa el código y mensaje por defecto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(apiFetch("/eventos/999/")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  test("409 sin cuerpo usa el código y mensaje por defecto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 409 })));

    await expect(apiFetch("/tipos-evento/", { method: "POST" })).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  test("500 sin cuerpo usa el código y mensaje por defecto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(apiFetch("/eventos/")).rejects.toMatchObject({
      code: "SERVER_ERROR",
      status: 500,
    });
  });

  test("un fallo de red se traduce a NETWORK_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(apiFetch("/eventos/")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 0,
    });
    await expect(apiFetch("/eventos/")).rejects.toBeInstanceOf(ApiError);
  });

  // custom_exception_handler real del backend (event/exceptions.py):
  // { success: false, error: { type, details } }, no el contrato "agreed"
  // { error: { code, message, fields } } que este cliente asumía antes.
  test("el envoltorio real del backend con detail como string se lee como el mensaje", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ success: false, error: { type: "InvalidCredentials", details: { detail: "Credenciales inválidas" } } }, 401)
      )
    );

    await expect(apiFetch("/auth/login/", { method: "POST" })).rejects.toMatchObject({
      message: "Credenciales inválidas",
      status: 401,
    });
  });

  test("el envoltorio real del backend con errores de campo los expone en fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ success: false, error: { type: "ValidationError", details: { name: ["Escribe el nombre del evento."] } } }, 400)
      )
    );

    await expect(apiFetch("/eventos/", { method: "POST" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
      fields: { name: "Escribe el nombre del evento." },
    });
  });

  test("un 401 llama al manejador global registrado con setUnauthorizedHandler", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(apiFetch("/eventos/")).rejects.toBeInstanceOf(ApiError);

    expect(handler).toHaveBeenCalledTimes(1);
    setUnauthorizedHandler(null);
  });

  test("un 401 de /auth/login/ NO llama al manejador global (es credencial inválida, no sesión expirada)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(apiFetch("/auth/login/", { method: "POST" })).rejects.toBeInstanceOf(ApiError);

    expect(handler).not.toHaveBeenCalled();
    setUnauthorizedHandler(null);
  });

  test("un 401 de /auth/me/ NO llama al manejador global (es el chequeo normal de sesión al montar, no una que expiró)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(apiFetch("/auth/me/")).rejects.toBeInstanceOf(ApiError);

    expect(handler).not.toHaveBeenCalled();
    setUnauthorizedHandler(null);
  });
});

describe("createSubtask", () => {
  test("el POST de gestión incluye priority: \"medium\" fijo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ subtask_id: 1, eid: 1 }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const payload: CreateSubtaskPayload = {
      title: "Confirmar catering",
      description: "",
      category: "Catering",
      estimated_hours: "2",
      scheduled_date: "2026-09-20",
      status: "pending",
    };

    await createSubtask(1, payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(options.body as string);
    expect(sentBody).toMatchObject({ ...payload, priority: "medium" });
  });
});
