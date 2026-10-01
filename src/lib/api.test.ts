import { afterEach, describe, expect, test, vi } from "vitest";
import { apiFetch, ApiError, createSubtask, setAccessToken, setUnauthorizedHandler } from "./api";
import type { CreateSubtaskPayload } from "./types";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  setAccessToken(null);
  setUnauthorizedHandler(null);
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

const refreshedSession = {
  user: { user_id: 1, name: "Demo", email: "demo@planificapp.com", max_daily_hours: "6.00" },
  access: "nuevo-access",
};

function authHeader(call: unknown[]): string | undefined {
  return ((call[1] as RequestInit).headers as Record<string, string>).Authorization;
}

describe("apiFetch con JWT", () => {
  test("envía Authorization: Bearer cuando hay token y respeta los headers del caller", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 200));
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("abc");

    await apiFetch("/eventos/", { headers: { "X-Test": "1" } });

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: "Bearer abc",
      "X-Test": "1",
      "Content-Type": "application/json",
    });
  });

  test("sin token no envía Authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 200));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/eventos/");

    expect(authHeader(fetchMock.mock.calls[0])).toBeUndefined();
  });

  test("un 401 dispara un refresh y reintenta la petición con el nuevo token", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/auth/refresh/")) return Promise.resolve(jsonResponse(refreshedSession, 200));
      const call = fetchMock.mock.calls.filter(([u]) => String(u).includes("/eventos/")).length;
      return Promise.resolve(call === 1 ? new Response(null, { status: 401 }) : jsonResponse([{ eid: 1 }], 200));
    });
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setAccessToken("viejo");

    const result = await apiFetch("/eventos/");

    expect(result).toEqual([{ eid: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/auth/refresh/");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", credentials: "include" });
    expect(authHeader(fetchMock.mock.calls[2])).toBe("Bearer nuevo-access");
    expect(handler).not.toHaveBeenCalled();
  });

  test("si el refresh falla, llama al manejador global, limpia el token y lanza el 401 original", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setAccessToken("viejo");

    await expect(apiFetch("/eventos/")).rejects.toMatchObject({ status: 401 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    await apiFetch("/eventos/").catch(() => {});
    expect(authHeader(fetchMock.mock.calls[0])).toBeUndefined();
  });

  test("si el reintento tras el refresh vuelve a dar 401, no hay más reintentos", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes("/auth/refresh/") ? jsonResponse(refreshedSession, 200) : new Response(null, { status: 401 })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(apiFetch("/eventos/")).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("si el refresh falla por red, conserva el token, no llama al handler y propaga NETWORK_ERROR", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      String(url).includes("/auth/refresh/")
        ? Promise.reject(new TypeError("Failed to fetch"))
        : Promise.resolve(new Response(null, { status: 401 }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setAccessToken("viejo");

    await expect(apiFetch("/eventos/")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });

    expect(handler).not.toHaveBeenCalled();
    fetchMock.mockClear();
    await apiFetch("/eventos/").catch(() => {});
    expect(authHeader(fetchMock.mock.calls[0])).toBe("Bearer viejo");
  });

  test("si el refresh da 5xx, conserva el token y no llama al handler", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(new Response(null, { status: String(url).includes("/auth/refresh/") ? 503 : 401 }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setAccessToken("viejo");

    await expect(apiFetch("/eventos/")).rejects.toMatchObject({ code: "SERVER_ERROR", status: 503 });

    expect(handler).not.toHaveBeenCalled();
    fetchMock.mockClear();
    await apiFetch("/eventos/").catch(() => {});
    expect(authHeader(fetchMock.mock.calls[0])).toBe("Bearer viejo");
  });

  test("si el refresh da 401 llama al handler; con 403 también", async () => {
    for (const status of [401, 403]) {
      const fetchMock = vi.fn().mockImplementation((url: string) =>
        Promise.resolve(new Response(null, { status: String(url).includes("/auth/refresh/") ? status : 401 }))
      );
      vi.stubGlobal("fetch", fetchMock);
      const handler = vi.fn();
      setUnauthorizedHandler(handler);

      await expect(apiFetch("/eventos/")).rejects.toMatchObject({ status: 401 });

      expect(handler).toHaveBeenCalledTimes(1);
    }
  });

  test("dos 401 simultáneos comparten un único refresh", async () => {
    const seen = new Set<string>();
    const fetchMock = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      const href = String(url);
      if (href.includes("/auth/refresh/")) {
        await new Promise((r) => setTimeout(r, 10));
        return jsonResponse(refreshedSession, 200);
      }
      const bearer = (options.headers as Record<string, string>).Authorization;
      if (bearer === "Bearer nuevo-access") return jsonResponse({ ok: true }, 200);
      seen.add(href);
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("viejo");

    const [a, b] = await Promise.all([apiFetch("/eventos/"), apiFetch("/categorias/")]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/auth/refresh/"));
    expect(refreshCalls).toHaveLength(1);
  });

  test.each(["/auth/login/", "/auth/register/", "/auth/me/", "/auth/refresh/", "/auth/logout/"])(
    "un 401 de %s nunca dispara un refresh",
    async (path) => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
      vi.stubGlobal("fetch", fetchMock);
      const handler = vi.fn();
      setUnauthorizedHandler(handler);

      await expect(apiFetch(path, { method: "POST" })).rejects.toMatchObject({ status: 401 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(handler).not.toHaveBeenCalled();
    }
  );
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
