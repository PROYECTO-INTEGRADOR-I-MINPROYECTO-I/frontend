import { afterEach, describe, expect, test, vi } from "vitest";
import { apiFetch, ApiError, createSubtask } from "./api";
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
