import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HomePage } from "./homepage";
import type { Event, Subtask } from "../lib/types";

const event: Event = {
  eid: 1,
  user: 1,
  name: "Boda Luisa & Carlos",
  description: "Ceremonia y recepción.",
  due_date: "2026-12-01T16:00:00.000Z",
  status: "pending",
  progress_percentage: 25,
  created_at: "2026-01-01T00:00:00.000Z",
};

function subtask(overrides: Partial<Subtask>): Subtask {
  return {
    subtask_id: overrides.subtask_id ?? 0,
    eid: 1,
    title: "Gestión",
    description: "",
    category: "Lugar",
    estimated_hours: "1",
    scheduled_date: "2026-09-20",
    status: "pending",
    ...overrides,
  };
}

const subtasks: Subtask[] = [
  // Vencidas (antes de "hoy" = 2026-09-20): por fecha asc y, en empate, más horas primero.
  subtask({ subtask_id: 1, title: "Vencida A", scheduled_date: "2026-09-18", estimated_hours: "1" }),
  subtask({ subtask_id: 2, title: "Vencida B", scheduled_date: "2026-09-18", estimated_hours: "3" }),
  subtask({ subtask_id: 3, title: "Vencida C", scheduled_date: "2026-09-15", estimated_hours: "5" }),
  // Para hoy: pendientes ordenadas por más horas primero.
  subtask({ subtask_id: 4, title: "Hoy A", scheduled_date: "2026-09-20", estimated_hours: "2" }),
  subtask({ subtask_id: 5, title: "Hoy B", scheduled_date: "2026-09-20", estimated_hours: "4" }),
  subtask({ subtask_id: 6, title: "Hoy Hecha", scheduled_date: "2026-09-20", estimated_hours: "1", status: "done" }),
  // Próximas (después de "hoy"): por fecha asc.
  subtask({ subtask_id: 7, title: "Próxima A", scheduled_date: "2026-09-25", estimated_hours: "1" }),
  subtask({ subtask_id: 8, title: "Próxima B", scheduled_date: "2026-09-22", estimated_hours: "10" }),
];

function stubHomepageFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    const href = String(url);
    if (href.includes("/eventos/1/subtareas/")) {
      return Promise.resolve(
        new Response(JSON.stringify(subtasks), { status: 200, headers: { "Content-Type": "application/json" } })
      );
    }
    if (href.includes("/eventos/")) {
      return Promise.resolve(
        new Response(JSON.stringify([event]), { status: 200, headers: { "Content-Type": "application/json" } })
      );
    }
    return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Igual que stubHomepageFetch, pero además atiende el PATCH /subtareas/<id>/
// (marcar/desmarcar completada) con la respuesta que decida `patchHandler`.
function stubHomepageFetchWithPatch(
  patchHandler: (subtaskId: number, body: Record<string, unknown>) => Promise<Response>
) {
  const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const href = String(url);
    const method = options?.method ?? "GET";
    const patchMatch = method === "PATCH" && href.match(/\/subtareas\/(\d+)\/$/);
    if (patchMatch) {
      const body = JSON.parse(String(options?.body ?? "{}"));
      return patchHandler(Number(patchMatch[1]), body);
    }
    if (href.includes("/eventos/1/subtareas/")) {
      return Promise.resolve(
        new Response(JSON.stringify(subtasks), { status: 200, headers: { "Content-Type": "application/json" } })
      );
    }
    if (href.includes("/eventos/")) {
      return Promise.resolve(
        new Response(JSON.stringify([event]), { status: 200, headers: { "Content-Type": "application/json" } })
      );
    }
    return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function columnCardTitles(headingName: string): string[] {
  const heading = screen.getByRole("heading", { name: headingName });
  const column = heading.closest("article");
  if (!column) throw new Error(`No se encontró la columna de "${headingName}"`);
  return within(column)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"))
    .filter((label): label is string => label !== null);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 20, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HomePage", () => {
  test("las secciones vencidas, hoy y próximas aparecen ordenadas por fecha y luego más horas primero", async () => {
    stubHomepageFetch();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
      </MemoryRouter>
    );

    await screen.findByText("Vencida A");

    expect(columnCardTitles("Vencidas")).toEqual(["Vencida C", "Vencida B", "Vencida A"]);
    expect(columnCardTitles("Próximas")).toEqual(["Próxima B", "Próxima A"]);

    // "Para Hoy" separa pendientes de completadas: cada lista se ordena por horas.
    expect(screen.getByText("Pendientes")).toBeInTheDocument();
    const pendingSection = screen.getByText("Pendientes").closest(".today-panel");
    expect(pendingSection).not.toBeNull();
    const pendingTitles = within(pendingSection as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(pendingTitles).toEqual(["Hoy B", "Hoy A"]);

    expect(screen.getByText("Hoy Hecha")).toBeInTheDocument();
  });

  test("marcar una gestión pendiente la mueve a Completadas y envía el PATCH {status: 'done'}", async () => {
    const fetchMock = stubHomepageFetchWithPatch((subtaskId, body) =>
      Promise.resolve(jsonResponse({ ...subtasks.find((item) => item.subtask_id === subtaskId), ...body }, 200))
    );
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
      </MemoryRouter>
    );
    await screen.findByText("Hoy A");

    await user.click(screen.getByRole("checkbox", { name: "Marcar Hoy A como completada" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, options]) => {
        const patchCall = String(url).includes("/subtareas/4/") && options?.method === "PATCH";
        return patchCall && JSON.parse(String(options.body)).status === "done";
      })).toBe(true)
    );

    const completedSection = screen.getByText("Completadas").closest(".today-panel") as HTMLElement;
    await waitFor(() =>
      expect(
        within(completedSection)
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label"))
      ).toContain("Hoy A")
    );
  });

  test("desmarcar una gestión completada envía el PATCH {status: 'pending'}", async () => {
    const fetchMock = stubHomepageFetchWithPatch((subtaskId, body) =>
      Promise.resolve(jsonResponse({ ...subtasks.find((item) => item.subtask_id === subtaskId), ...body }, 200))
    );
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
      </MemoryRouter>
    );
    await screen.findByText("Hoy Hecha");

    await user.click(screen.getByRole("checkbox", { name: "Marcar Hoy Hecha como completada" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, options]) => {
        const patchCall = String(url).includes("/subtareas/6/") && options?.method === "PATCH";
        return patchCall && JSON.parse(String(options.body)).status === "pending";
      })).toBe(true)
    );
  });

  test("si el PATCH falla, revierte el cambio y 'Reintentar' vuelve a intentar con éxito", async () => {
    let callCount = 0;
    stubHomepageFetchWithPatch((subtaskId, body) => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(jsonResponse({ ...subtasks.find((item) => item.subtask_id === subtaskId), ...body }, 200));
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
      </MemoryRouter>
    );
    await screen.findByText("Hoy B");

    await user.click(screen.getByRole("checkbox", { name: "Marcar Hoy B como completada" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sin conexión. No se guardó el cambio.");

    // Se revirtió: "Hoy B" sigue en Pendientes, no en Completadas.
    const pendingSection = screen.getByText("Pendientes").closest(".today-panel") as HTMLElement;
    expect(
      within(pendingSection)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
    ).toContain("Hoy B");

    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    const completedSection = screen.getByText("Completadas").closest(".today-panel") as HTMLElement;
    await waitFor(() =>
      expect(
        within(completedSection)
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label"))
      ).toContain("Hoy B")
    );
  });
});
