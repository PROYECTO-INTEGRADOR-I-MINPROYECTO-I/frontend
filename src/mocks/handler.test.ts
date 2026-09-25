import { beforeEach, describe, expect, test, vi } from "vitest";

// El handler y el store cachean estado (getDb) y localStorage entre
// llamadas: se reimporta el módulo fresco en cada test para que cada uno
// arranque desde la semilla inicial.
async function freshHandler() {
  vi.resetModules();
  const { handleMockRequest } = await import("./handler");
  return handleMockRequest;
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("modo mock: validaciones", () => {
  test("horas <= 0 al crear una gestión responde 400 con el mensaje en estimated_hours", async () => {
    const handleMockRequest = await freshHandler();

    const response = await handleMockRequest(
      "/eventos/1/subtareas/",
      "POST",
      JSON.stringify({
        title: "Gestión inválida",
        category: "Lugar",
        estimated_hours: "0",
        scheduled_date: "2026-09-20",
      }),
      undefined
    );

    expect(response.status).toBe(400);
    const body = await readJson(response);
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fields: { estimated_hours: "Las horas estimadas deben ser mayores a 0." },
      },
    });
  });

  test("crea una gestión válida", async () => {
    const handleMockRequest = await freshHandler();

    const response = await handleMockRequest(
      "/eventos/1/subtareas/",
      "POST",
      JSON.stringify({
        title: "Reservar salón",
        category: "Lugar",
        estimated_hours: "2",
        scheduled_date: "2026-09-20",
      }),
      undefined
    );

    expect(response.status).toBe(201);
    const body = await readJson(response);
    expect(body).toMatchObject({
      title: "Reservar salón",
      category: "Lugar",
      estimated_hours: "2",
      scheduled_date: "2026-09-20",
      status: "pending",
    });
  });

  test("edita una gestión existente", async () => {
    const handleMockRequest = await freshHandler();

    const updateResponse = await handleMockRequest(
      "/subtareas/1/",
      "PATCH",
      JSON.stringify({ title: "Confirmar catering final" }),
      undefined
    );

    expect(updateResponse.status).toBe(200);
    const body = await readJson(updateResponse);
    expect(body.title).toBe("Confirmar catering final");
  });

  test("ignora priority al crear una gestión", async () => {
    const handleMockRequest = await freshHandler();

    const response = await handleMockRequest(
      "/eventos/1/subtareas/",
      "POST",
      JSON.stringify({
        title: "Gestión con prioridad",
        category: "Lugar",
        estimated_hours: "1",
        scheduled_date: "2026-09-20",
        priority: "urgent",
      }),
      undefined
    );

    expect(response.status).toBe(201);
    const body = await readJson(response);
    expect(body).not.toHaveProperty("priority");
  });
});
