import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
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

  test("Completadas muestra gestiones de cualquier fecha, y desmarcar las devuelve a Vencidas/Próximas", async () => {
    stubHomepageFetchWithPatch((subtaskId, body) =>
      Promise.resolve(jsonResponse({ ...subtasks.find((item) => item.subtask_id === subtaskId), ...body }, 200))
    );
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
      </MemoryRouter>
    );
    await screen.findByText("Vencida A");
    const todayCount = () =>
      (screen.getByRole("heading", { name: "Para Hoy" }).closest("article") as HTMLElement).querySelector(
        ".task-count"
      )?.textContent;
    const todayCountBefore = todayCount();

    // Completar una vencida (id 1) y una próxima (id 7): ambas deben
    // aparecer en Completadas, sin importar que su fecha no sea hoy.
    await user.click(screen.getByRole("checkbox", { name: "Marcar Vencida A como completada" }));
    await user.click(screen.getByRole("checkbox", { name: "Marcar Próxima A como completada" }));

    const completedTitles = () =>
      within(screen.getByText("Completadas").closest(".today-panel") as HTMLElement)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"));

    await waitFor(() => expect(completedTitles()).toEqual(expect.arrayContaining(["Vencida A", "Próxima A"])));

    // Y ya no siguen en su columna original.
    expect(columnCardTitles("Vencidas")).not.toContain("Vencida A");
    expect(columnCardTitles("Próximas")).not.toContain("Próxima A");
    // El contador de "Para Hoy" no cuenta completadas de otras fechas.
    expect(todayCount()).toBe(todayCountBefore);

    // Desmarcarlas las devuelve a su columna según la fecha.
    await user.click(screen.getByRole("checkbox", { name: "Marcar Vencida A como completada" }));
    await user.click(screen.getByRole("checkbox", { name: "Marcar Próxima A como completada" }));

    await waitFor(() => expect(columnCardTitles("Vencidas")).toContain("Vencida A"));
    await waitFor(() => expect(columnCardTitles("Próximas")).toContain("Próxima A"));
    expect(completedTitles()).not.toEqual(expect.arrayContaining(["Vencida A", "Próxima A"]));
  });

  test("togglear una gestión no bloquea otra, y un segundo clic sobre una gestión pendiente no reenvía el PATCH", async () => {
    const resolvers: Record<number, (response: Response) => void> = {};
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      const patchMatch = method === "PATCH" && href.match(/\/subtareas\/(\d+)\/$/);
      if (patchMatch) {
        const subtaskId = Number(patchMatch[1]);
        return new Promise<Response>((resolve) => {
          resolvers[subtaskId] = resolve;
        });
      }
      if (href.includes("/eventos/1/subtareas/")) {
        return Promise.resolve(jsonResponse(subtasks, 200));
      }
      if (href.includes("/eventos/")) {
        return Promise.resolve(jsonResponse([event], 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
      </MemoryRouter>
    );
    await screen.findByText("Hoy A");

    const patchCallsFor = (subtaskId: number) =>
      fetchMock.mock.calls.filter(
        ([url, options]) => String(url).includes(`/subtareas/${subtaskId}/`) && options?.method === "PATCH"
      );

    await user.click(screen.getByRole("checkbox", { name: "Marcar Hoy A como completada" }));
    expect(screen.getByRole("checkbox", { name: "Marcar Hoy A como completada" })).toBeDisabled();

    // B se puede togglear aunque A siga en vuelo: no comparten el mismo "lock".
    await user.click(screen.getByRole("checkbox", { name: "Marcar Hoy B como completada" }));
    expect(screen.getByRole("checkbox", { name: "Marcar Hoy B como completada" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Marcar Hoy A como completada" })).toBeDisabled();

    expect(patchCallsFor(4)).toHaveLength(1);

    // Clic extra sobre A mientras sigue pendiente: no dispara un segundo PATCH.
    await user.click(screen.getByRole("checkbox", { name: "Marcar Hoy A como completada" }));
    expect(patchCallsFor(4)).toHaveLength(1);

    resolvers[5](jsonResponse({ ...subtasks.find((item) => item.subtask_id === 5), status: "done" }, 200));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Marcar Hoy B como completada" })).not.toBeDisabled()
    );
    // A se libera de forma independiente: sigue deshabilitado hasta que su propio PATCH resuelva.
    expect(screen.getByRole("checkbox", { name: "Marcar Hoy A como completada" })).toBeDisabled();

    resolvers[4](jsonResponse({ ...subtasks.find((item) => item.subtask_id === 4), status: "done" }, 200));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Marcar Hoy A como completada" })).not.toBeDisabled()
    );
    expect(patchCallsFor(4)).toHaveLength(1);
  });

  test("si el PATCH de completar falla, la reversión no pisa cambios hechos mientras tanto (ej. la descripción)", async () => {
    let rejectToggle: (() => void) | null = null;
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      const patchMatch = method === "PATCH" && href.match(/\/subtareas\/(\d+)\/$/);
      if (patchMatch) {
        const subtaskId = Number(patchMatch[1]);
        const body = JSON.parse(String(options?.body ?? "{}"));
        if ("status" in body) {
          // El PATCH de completar se queda pendiente hasta que el test lo resuelva/rechace.
          return new Promise<Response>((_resolve, reject) => {
            rejectToggle = () => reject(new TypeError("Failed to fetch"));
          });
        }
        // Cualquier otra edición (ej. la descripción) se guarda de inmediato,
        // simulando que el servidor ya procesó el "completar" (status: "done")
        // antes de que la respuesta de esa petición se perdiera para el cliente.
        const base = subtasks.find((item) => item.subtask_id === subtaskId);
        return Promise.resolve(jsonResponse({ ...base, status: "done", ...body }, 200));
      }
      if (href.includes("/eventos/1/subtareas/")) {
        return Promise.resolve(jsonResponse(subtasks, 200));
      }
      if (href.includes("/eventos/")) {
        return Promise.resolve(jsonResponse([event], 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
      </MemoryRouter>
    );
    await screen.findByText("Hoy B");

    await user.click(screen.getByRole("checkbox", { name: "Marcar Hoy B como completada" }));

    // Mientras el PATCH de completar sigue pendiente, se edita la descripción.
    await user.click(screen.getByRole("button", { name: "Hoy B" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const descriptionField = await screen.findByLabelText("Descripción");
    await user.clear(descriptionField);
    await user.type(descriptionField, "Descripción editada mientras se completaba");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar gestión" })).not.toBeInTheDocument());

    // Ahora falla el PATCH de completar: la reversión debe tocar solo el status.
    expect(rejectToggle).not.toBeNull();
    rejectToggle!();

    await screen.findByRole("alert");

    // Se reabre el detalle para comprobar que la descripción editada sigue ahí
    // y que el estado volvió a pendiente (no se perdió el cambio concurrente).
    await user.click(screen.getByRole("button", { name: "Hoy B" }));
    expect(await screen.findByText("Descripción editada mientras se completaba")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar como completada" })).toBeInTheDocument();
  });

  test("crear un evento muestra el aviso con el nombre del evento creado", async () => {
    const user = userEvent.setup();
    const createdEvent: Event = {
      eid: 2,
      user: 1,
      name: "Cumpleaños de Ana",
      description: "",
      due_date: "2026-11-01T18:00:00.000Z",
      status: "pending",
      progress_percentage: 0,
      created_at: "2026-09-20T00:00:00.000Z",
    };
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      if (href.includes("/tipos-evento/")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      if (method === "POST" && href.includes("/eventos/")) {
        return Promise.resolve(
          new Response(JSON.stringify(createdEvent), { status: 201, headers: { "Content-Type": "application/json" } })
        );
      }
      if (href.includes("/eventos/2/subtareas/")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })
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

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HomePage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Nuevo Evento" }));
    await user.click(screen.getByRole("menuitem", { name: "Nuevo" }));

    const typeSelect = await screen.findByLabelText("Tipo");
    await waitFor(() => expect(typeSelect).not.toBeDisabled());

    await user.type(screen.getByLabelText("Nombre"), "Cumpleaños de Ana");
    await user.selectOptions(typeSelect, "Boda");
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "18:00" } });

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("Se ha creado exitosamente el evento «Cumpleaños de Ana».")
    ).toBeInTheDocument();
  });

  test("crear una gestión muestra el aviso con el título de la gestión creada", async () => {
    const user = userEvent.setup();
    const createdSubtask: Subtask = subtask({
      subtask_id: 99,
      title: "Confirmar catering",
      scheduled_date: "2026-09-20",
      estimated_hours: "0.25",
    });
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      if (href.includes("/categorias/")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      if (method === "POST" && href.includes("/eventos/1/subtareas/")) {
        return Promise.resolve(
          new Response(JSON.stringify(createdSubtask), { status: 201, headers: { "Content-Type": "application/json" } })
        );
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

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
      </MemoryRouter>
    );
    await screen.findByText("Vencida A");

    await user.click(screen.getByRole("button", { name: /Crear gestión/ }));

    const categorySelect = await screen.findByLabelText("Categoría");
    await waitFor(() => expect(categorySelect).not.toBeDisabled());

    await user.type(screen.getByLabelText("Nombre"), "Confirmar catering");
    await user.selectOptions(categorySelect, "Catering");
    fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-09-20" } });
    await user.click(screen.getByRole("button", { name: "15 min" }));

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("Se ha creado exitosamente la gestión «Confirmar catering».")
    ).toBeInTheDocument();
  });

  test("por defecto se ve la vista 'Plan inicial' con las columnas", async () => {
    stubHomepageFetch();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
      </MemoryRouter>
    );

    await screen.findByText("Vencida A");

    expect(screen.getByRole("heading", { name: /Plan inicial/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Plan inicial" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Próximas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Para Hoy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vencidas" })).toBeInTheDocument();
  });

  test("la pestaña Hoy muestra el estado 'Próximamente' y oculta las columnas", async () => {
    stubHomepageFetch();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
      </MemoryRouter>
    );
    await screen.findByText("Vencida A");

    await user.click(screen.getByRole("tab", { name: "Hoy" }));

    expect(
      await screen.findByText(
        "La vista Hoy estará disponible pronto: aquí verás las gestiones de hoy de todos tus eventos."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Próximas" })).not.toBeInTheDocument();
    expect(document.getElementById("plan-inicial-panel")).toHaveAttribute("hidden");
  });

  test("volver a 'Plan inicial' desde Hoy conserva el evento seleccionado", async () => {
    stubHomepageFetch();
    const user = userEvent.setup();
    // Muestra la query string actual para poder leerla desde el test.
    function LocationProbe() {
      return <output data-testid="location-search">{useLocation().search}</output>;
    }
    const currentParams = () => new URLSearchParams(screen.getByTestId("location-search").textContent ?? "");

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <HomePage />
        <LocationProbe />
      </MemoryRouter>
    );
    await screen.findByText("Vencida A");

    await user.click(screen.getByRole("tab", { name: "Hoy" }));
    await screen.findByText(
      "La vista Hoy estará disponible pronto: aquí verás las gestiones de hoy de todos tus eventos."
    );
    // Cambiar de vista no pisa ?evento= en la URL.
    expect(currentParams().get("evento")).toBe("1");
    expect(currentParams().get("vista")).toBe("hoy");

    await user.click(screen.getByRole("tab", { name: "Plan inicial" }));

    expect(await screen.findByText("Vencida A")).toBeInTheDocument();
    expect(currentParams().get("evento")).toBe("1");
  });

  test("un ?vista= inválido cae en Plan inicial", async () => {
    stubHomepageFetch();

    render(
      <MemoryRouter initialEntries={["/?evento=1&vista=xyz"]}>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: "Plan inicial" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Vencida A")).toBeInTheDocument();
  });

  test("?vista=hoy en la URL abre directamente la pestaña Hoy", async () => {
    stubHomepageFetch();

    render(
      <MemoryRouter initialEntries={["/?evento=1&vista=hoy"]}>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: "Hoy" })).toHaveAttribute("aria-selected", "true");
    expect(
      await screen.findByText(
        "La vista Hoy estará disponible pronto: aquí verás las gestiones de hoy de todos tus eventos."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Próximas" })).not.toBeInTheDocument();
  });
});
