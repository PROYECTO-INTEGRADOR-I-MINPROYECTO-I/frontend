import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ReprogramModal } from "./reprogram-modal";
import type { Subtask } from "../lib/types";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const subtask: Subtask = {
  subtask_id: 10,
  eid: 1,
  title: "Reservar salón",
  description: "",
  category: "Lugar",
  estimated_hours: "2",
  scheduled_date: "2026-10-20",
  status: "pending",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 10, 0)); // 2026-10-15
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ReprogramModal", () => {
  test("precarga la fecha y la duración actuales de la gestión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no debería llamarse sin submit")));
    render(
      <ReprogramModal
        subtask={subtask}
        eventName="Boda Luisa & Carlos"
        eventDueDate="2026-12-01T16:00:00.000Z"
        maxDailyHours="6.00"
        onClose={vi.fn()}
        onReprogrammed={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Nueva fecha")).toHaveValue("2026-10-20");
    expect(await screen.findByRole("button", { name: "2 h" })).toHaveAttribute("aria-pressed", "true");
  });

  test("sin conflicto, guarda directo con PATCH /subtareas/<id>/ y llama a onReprogrammed", async () => {
    const user = userEvent.setup();
    const onReprogrammed = vi.fn();
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      if (href.includes("/hoy/")) {
        return Promise.resolve(
          jsonResponse(
            { fecha: "2026-10-15", metrica: "gestiones", vencidas: [], para_hoy: { pendientes: [], completadas: [] }, proximas: [], progreso_dia: { completadas: 0, total: 0, horas_completadas: "0", horas_totales: "0" }, filtros: { event_id: null, status: null } },
            200
          )
        );
      }
      if (method === "PATCH" && href.includes("/subtareas/10/")) {
        const body = JSON.parse(String(options?.body ?? "{}"));
        return Promise.resolve(jsonResponse({ ...subtask, ...body }, 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ReprogramModal
        subtask={subtask}
        eventName="Boda Luisa & Carlos"
        eventDueDate="2026-12-01T16:00:00.000Z"
        maxDailyHours="6.00"
        onClose={vi.fn()}
        onReprogrammed={onReprogrammed}
      />
    );

    fireEvent.change(screen.getByLabelText("Nueva fecha"), { target: { value: "2026-10-25" } });
    await user.click(screen.getByRole("button", { name: "Reprogramar" }));

    await waitFor(() => expect(onReprogrammed).toHaveBeenCalled());
    const patchCall = fetchMock.mock.calls.find(
      ([url, options]) => String(url).includes("/subtareas/10/") && options?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();
    const sentBody = JSON.parse(String(patchCall?.[1]?.body));
    expect(sentBody).toMatchObject({ scheduled_date: "2026-10-25", estimated_hours: "2" });
  });

  test("con conflicto, abre el wizard de resolución en vez de guardar, y 'Confirmar' aplica la fecha sugerida al campo", async () => {
    const user = userEvent.setup();
    const onReprogrammed = vi.fn();
    // Límite 6h; día destino (10-25) ya tiene 5h de otra gestión (evento B);
    // esta gestión reprogramada a 2h haría 7h > 6h: conflicto.
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      if (href.includes("/hoy/")) {
        return Promise.resolve(
          jsonResponse(
            {
              fecha: "2026-10-15",
              metrica: "gestiones",
              vencidas: [],
              para_hoy: { pendientes: [], completadas: [] },
              proximas: [
                { subtask_id: 99, eid: 2, title: "Otra gestión", description: "", category: "Lugar", estimated_hours: "5", scheduled_date: "2026-10-25", status: "pending" },
              ],
              progreso_dia: { completadas: 0, total: 0, horas_completadas: "0", horas_totales: "0" },
              filtros: { event_id: null, status: null },
            },
            200
          )
        );
      }
      if (method === "PATCH" && href.includes("/subtareas/10/")) {
        return Promise.resolve(jsonResponse({ ...subtask }, 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ReprogramModal
        subtask={subtask}
        eventName="Boda Luisa & Carlos"
        eventDueDate="2026-12-01T16:00:00.000Z"
        maxDailyHours="6.00"
        onClose={vi.fn()}
        onReprogrammed={onReprogrammed}
      />
    );

    fireEvent.change(screen.getByLabelText("Nueva fecha"), { target: { value: "2026-10-25" } });
    await user.click(screen.getByRole("button", { name: "Reprogramar" }));

    expect(await screen.findByText("¡Esta reprogramación supera tu límite diario!")).toBeInTheDocument();
    // No debe haber guardado nada todavía.
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(false);
    // Un solo popup visible a la vez: el form de "Reprogramar gestión" se
    // oculta (no solo queda detrás) mientras el wizard de conflicto está arriba.
    expect(screen.queryByRole("dialog", { name: "Reprogramar gestión" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver opciones de solución" }));
    // Nada más está agendado ese rango: el día siguiente (10-26) debería tener capacidad.
    await user.click(screen.getByRole("button", { name: "Opción 1: Reprogramar para 26 oct" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    // Vuelve al form con la fecha ya actualizada, sin haber guardado por su cuenta.
    expect(screen.queryByText("¡Esta reprogramación supera tu límite diario!")).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Reprogramar gestión" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nueva fecha")).toHaveValue("2026-10-26");
    expect(onReprogrammed).not.toHaveBeenCalled();
  });
});
