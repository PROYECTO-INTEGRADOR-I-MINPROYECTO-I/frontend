import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HomePage } from "./homepage";
import { AuthProvider } from "../lib/auth";
import type { Event, Subtask, TodaySummary } from "../lib/types";

const TODAY = "2026-09-20";

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

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Deriva la respuesta de GET /api/hoy/ a partir de una lista plana de
// gestiones, con el mismo criterio de agrupación que planning/services.py:
// vencidas = pending antes de hoy, para_hoy separa pending/done de HOY,
// proximas = pending después de hoy. Una completada de otra fecha (vencida o
// próxima) no aparece en ningún grupo — la misma limitación conocida de
// PIM1-55 (ver el comentario en homepage.tsx).
function buildTodaySummary(items: Subtask[], eventId: number | null = null): TodaySummary {
  const withEventName = items.map((item) => ({ ...item, event_name: event.name }));
  const vencidas = withEventName.filter((item) => item.status === "pending" && item.scheduled_date < TODAY);
  const pendientes = withEventName.filter((item) => item.status === "pending" && item.scheduled_date === TODAY);
  const completadas = withEventName.filter((item) => item.status === "done" && item.scheduled_date === TODAY);
  const proximas = withEventName.filter((item) => item.status === "pending" && item.scheduled_date > TODAY);
  const horasCompletadas = completadas.reduce((sum, item) => sum + Number(item.estimated_hours), 0);
  const horasTotales = horasCompletadas + pendientes.reduce((sum, item) => sum + Number(item.estimated_hours), 0);

  return {
    fecha: TODAY,
    metrica: "gestiones",
    vencidas,
    para_hoy: { pendientes, completadas },
    proximas,
    progreso_dia: {
      completadas: completadas.length,
      total: pendientes.length + completadas.length,
      horas_completadas: horasCompletadas.toFixed(2),
      horas_totales: horasTotales.toFixed(2),
    },
    filtros: { event_id: eventId, status: null },
  };
}

function eventIdFromHoyUrl(href: string): number | null {
  const match = href.match(/event_id=(\d+)/);
  return match ? Number(match[1]) : null;
}

// EventsView (pestaña Eventos) sigue usando /eventos/<eid>/subtareas/ para su
// propio resumen por card — no lo toca PIM1-55, así que el stub atiende
// ambos endpoints: ese de siempre, y el nuevo /hoy/ para la pestaña Hoy.
function stubHomepageFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    const href = String(url);
    if (href.includes("/hoy/")) {
      return Promise.resolve(jsonResponse(buildTodaySummary(subtasks, eventIdFromHoyUrl(href)), 200));
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
  return fetchMock;
}

// Igual que stubHomepageFetch, pero además atiende el PATCH /subtareas/<id>/
// (marcar/desmarcar completada) con la respuesta que decida `patchHandler`.
// Tras un PATCH exitoso, homepage.tsx vuelve a pedir /api/hoy/ (ya no hace un
// parche optimista in-place): este stub recuerda esa respuesta para que el
// refetch la refleje, igual que haría el backend real.
function stubHomepageFetchWithPatch(
  patchHandler: (subtaskId: number, body: Record<string, unknown>) => Promise<Response>
) {
  let currentSubtasks = subtasks;
  const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const href = String(url);
    const method = options?.method ?? "GET";
    const patchMatch = method === "PATCH" && href.match(/\/subtareas\/(\d+)\/$/);
    if (patchMatch) {
      const subtaskId = Number(patchMatch[1]);
      const body = JSON.parse(String(options?.body ?? "{}"));
      return patchHandler(subtaskId, body).then(async (response) => {
        if (response.ok) {
          const updated = await response.clone().json();
          currentSubtasks = currentSubtasks.map((item) => (item.subtask_id === subtaskId ? updated : item));
        }
        return response;
      });
    }
    if (href.includes("/hoy/")) {
      return Promise.resolve(jsonResponse(buildTodaySummary(currentSubtasks, eventIdFromHoyUrl(href)), 200));
    }
    if (href.includes("/eventos/1/subtareas/")) {
      return Promise.resolve(jsonResponse(currentSubtasks, 200));
    }
    if (href.includes("/eventos/")) {
      return Promise.resolve(jsonResponse([event], 200));
    }
    return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText("Vencida A");

    expect(columnCardTitles("Vencidas")).toEqual(["Vencida C", "Vencida B", "Vencida A"]);
    expect(columnCardTitles("Próximos 7 días")).toEqual(["Próxima B", "Próxima A"]);

    // "Para Hoy" separa pendientes de completadas: cada lista se ordena por horas.
    expect(screen.getByText("Pendientes")).toBeInTheDocument();
    const pendingSection = screen.getByText("Pendientes").closest(".today-panel");
    expect(pendingSection).not.toBeNull();
    const pendingTitles = within(pendingSection as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"))
      .filter((label): label is string => label !== null);
    expect(pendingTitles).toEqual(["Hoy B", "Hoy A"]);

    expect(screen.getByText("Hoy Hecha")).toBeInTheDocument();
  });

  test("la barra de progreso del día usa progreso_dia de /api/hoy/, y el toggle cambia a horas sin volver a pedir datos", async () => {
    const fetchMock = stubHomepageFetch();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );
    await screen.findByText("Vencida A");

    // Hoy (2026-09-20): Hoy A (2h, pendiente) + Hoy B (4h, pendiente) + Hoy Hecha (1h, completada).
    expect(screen.getByText("1/3 gestiones para hoy completadas")).toBeInTheDocument();

    const callsBeforeToggle = fetchMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Horas" }));

    expect(screen.getByText("1 h/7 h horas para hoy completadas")).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(callsBeforeToggle);
  });

  test("sin gestiones para hoy puntualmente (pero sí vencidas/próximas), muestra un único aviso grande en la columna 'Para Hoy'", async () => {
    const noTodaySubtasks: Subtask[] = [
      subtask({ subtask_id: 1, title: "Vencida A", scheduled_date: "2026-09-18", estimated_hours: "1" }),
      subtask({ subtask_id: 7, title: "Próxima A", scheduled_date: "2026-09-25", estimated_hours: "1" }),
    ];
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/hoy/")) {
        return Promise.resolve(jsonResponse(buildTodaySummary(noTodaySubtasks, eventIdFromHoyUrl(href)), 200));
      }
      if (href.includes("/eventos/1/subtareas/")) {
        return Promise.resolve(jsonResponse(noTodaySubtasks, 200));
      }
      if (href.includes("/eventos/")) {
        return Promise.resolve(jsonResponse([event], 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );
    await screen.findByText("Vencida A");

    // Sin barra de progreso (progreso_dia.total === 0: nada agendado para hoy).
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("Mostrar progreso en:")).not.toBeInTheDocument();

    // Un único aviso grande, no los dos paneles vacíos por separado.
    expect(screen.getByText("No hay tareas asignadas para hoy.")).toBeInTheDocument();
    expect(screen.queryByText("Sin pendientes para hoy.")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin gestiones completadas.")).not.toBeInTheDocument();
  });

  test("marcar una gestión pendiente la mueve a Completadas y envía el PATCH {status: 'done'}", async () => {
    const fetchMock = stubHomepageFetchWithPatch((subtaskId, body) =>
      Promise.resolve(jsonResponse({ ...subtasks.find((item) => item.subtask_id === subtaskId), ...body }, 200))
    );
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
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
          .filter((label): label is string => label !== null)
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
        <AuthProvider><HomePage /></AuthProvider>
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

  test("si el PATCH falla, muestra el error y 'Reintentar' vuelve a intentar con éxito", async () => {
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
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );
    await screen.findByText("Hoy B");

    await user.click(screen.getByRole("checkbox", { name: "Marcar Hoy B como completada" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sin conexión. No se guardó el cambio.");

    // Sin flip optimista (PIM1-55): al fallar el PATCH nunca se movió de
    // Pendientes en primer lugar, así que no hay nada que revertir.
    const pendingSection = screen.getByText("Pendientes").closest(".today-panel") as HTMLElement;
    expect(
      within(pendingSection)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
        .filter((label): label is string => label !== null)
    ).toContain("Hoy B");

    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    const completedSection = screen.getByText("Completadas").closest(".today-panel") as HTMLElement;
    await waitFor(() =>
      expect(
        within(completedSection)
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label"))
          .filter((label): label is string => label !== null)
      ).toContain("Hoy B")
    );
  });

  // PIM1-55, limitación conocida (ver el comentario en homepage.tsx):
  // /api/hoy/ solo trae en "para_hoy.completadas" lo completado HOY; una
  // vencida o próxima marcada como completada no aparece en ningún grupo de
  // la respuesta, así que desaparece de Hoy en vez de pasar a Completadas
  // como pasaba antes. Backend tiene en desarrollo un parámetro para
  // recuperar el comportamiento original.
  test("marcar como completada una vencida o próxima la saca de Hoy (no aparece en Completadas)", async () => {
    stubHomepageFetchWithPatch((subtaskId, body) =>
      Promise.resolve(jsonResponse({ ...subtasks.find((item) => item.subtask_id === subtaskId), ...body }, 200))
    );
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );
    await screen.findByText("Vencida A");

    const completedTitles = () =>
      within(screen.getByText("Completadas").closest(".today-panel") as HTMLElement)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
        .filter((label): label is string => label !== null);

    await user.click(screen.getByRole("checkbox", { name: "Marcar Vencida A como completada" }));
    await waitFor(() => expect(columnCardTitles("Vencidas")).not.toContain("Vencida A"));
    expect(completedTitles()).not.toContain("Vencida A");

    await user.click(screen.getByRole("checkbox", { name: "Marcar Próxima A como completada" }));
    await waitFor(() => expect(columnCardTitles("Próximos 7 días")).not.toContain("Próxima A"));
    expect(completedTitles()).not.toContain("Próxima A");
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
      if (href.includes("/hoy/")) {
        return Promise.resolve(jsonResponse(buildTodaySummary(subtasks, eventIdFromHoyUrl(href)), 200));
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
        <AuthProvider><HomePage /></AuthProvider>
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

  // (Antes había un test acá sobre que la reversión de un PATCH de completar
  // fallido no debía pisar una edición concurrente de otro campo. Ya no
  // aplica: PIM1-55 quitó el flip optimista, así que no hay ningún campo que
  // revertir ni forma de que esa clase de bug ocurra.)

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
      if (href.includes("/hoy/")) {
        return Promise.resolve(jsonResponse(buildTodaySummary([], eventIdFromHoyUrl(href)), 200));
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
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Todos los eventos" }));
    await user.click(screen.getByRole("menuitem", { name: "Nuevo" }));

    // PIM1-117: "Nuevo" ahora abre el wizard (intro + stages), no el modal directo.
    await user.click(await screen.findByRole("button", { name: "Comenzar" }));

    const typeSelect = await screen.findByLabelText("Tipo");
    await waitFor(() => expect(typeSelect).not.toBeDisabled());
    await user.type(screen.getByLabelText("Nombre"), "Cumpleaños de Ana");
    await user.selectOptions(typeSelect, "Boda");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.change(await screen.findByLabelText("Fecha"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "18:00" } });
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    // Última stage ("¿Para quién?"): acá se crea el evento de verdad.
    await user.click(await screen.findByRole("button", { name: "Crear evento" }));

    expect(
      await screen.findByText("Se ha creado exitosamente el evento «Cumpleaños de Ana».")
    ).toBeInTheDocument();
    // Tras crear, el wizard pasa a la stage de plan inicial de gestiones.
    expect(await screen.findByText("Plan inicial de gestiones")).toBeInTheDocument();
  });

  test("crear un evento y una gestión en el wizard actualiza la vista de Hoy de inmediato", async () => {
    const user = userEvent.setup();
    const createdEvent: Event = {
      eid: 2,
      user: 1,
      name: "Cumpleaños de Ana",
      description: "",
      due_date: "2026-09-23T18:00:00.000Z",
      status: "pending",
      progress_percentage: 0,
      created_at: "2026-09-20T00:00:00.000Z",
    };
    // Fecha dentro de la ventana de "próximas" (dias_proximos, 7 por
    // defecto en el backend real — ver planning/views.py): a diferencia de
    // buildTodaySummary (el mock de este test, sin ese recorte), el backend
    // real NO muestra en /api/hoy/ una gestión agendada más allá de esa
    // ventana, aunque sí exista (se ve en la vista expandida de Eventos, que
    // no tiene ese límite). Por eso la fecha de prueba aquí importa: debe
    // quedar dentro de la ventana para que este test siga siendo
    // representativo del comportamiento real.
    const createdSubtask: Subtask = {
      subtask_id: 50,
      eid: 2,
      title: "Reservar salón",
      description: "",
      category: "Lugar",
      estimated_hours: "2",
      scheduled_date: "2026-09-23",
      status: "pending",
    };
    // Mock CON ESTADO: /hoy/ solo devuelve una gestión si ya se "creó" de
    // verdad (POST ya resuelto) — a diferencia de un mock estático, esto
    // prueba que loadToday se vuelve a llamar DESPUÉS de crear la gestión,
    // no que el primer loadToday (al seleccionar el evento, antes de crear
    // nada) ya la traía de pura casualidad.
    let subtasksOfEvent2: Subtask[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      if (href.includes("/tipos-evento/") || href.includes("/categorias/")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      if (method === "POST" && href.includes("/eventos/") && !href.includes("subtareas")) {
        return Promise.resolve(jsonResponse(createdEvent, 201));
      }
      if (method === "POST" && href.includes("/eventos/2/subtareas/")) {
        subtasksOfEvent2 = [...subtasksOfEvent2, createdSubtask];
        return Promise.resolve(jsonResponse(createdSubtask, 201));
      }
      if (href.includes("/eventos/1/subtareas/") || href.includes("/eventos/2/subtareas/")) {
        return Promise.resolve(jsonResponse([], 200));
      }
      if (href.includes("/hoy/")) {
        const eid = eventIdFromHoyUrl(href);
        const items = eid === 2 ? subtasksOfEvent2 : [];
        return Promise.resolve(jsonResponse(buildTodaySummary(items, eid), 200));
      }
      if (href.includes("/eventos/")) {
        return Promise.resolve(jsonResponse([event], 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole("button", { name: "Todos los eventos" }));
    await user.click(screen.getByRole("menuitem", { name: "Nuevo" }));
    await user.click(await screen.findByRole("button", { name: "Comenzar" }));

    const typeSelect = await screen.findByLabelText("Tipo");
    await waitFor(() => expect(typeSelect).not.toBeDisabled());
    await user.type(screen.getByLabelText("Nombre"), "Cumpleaños de Ana");
    await user.selectOptions(typeSelect, "Boda");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.change(await screen.findByLabelText("Fecha"), { target: { value: "2026-09-23" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "18:00" } });
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(await screen.findByRole("button", { name: "Crear evento" }));
    await screen.findByText("Plan inicial de gestiones");

    const wizardDialog = screen.getByRole("dialog", { name: "Cumpleaños de Ana" });
    await user.click(within(wizardDialog).getByRole("button", { name: "Agregar gestión" }));
    await user.type(await screen.findByLabelText("Nombre"), "Reservar salón");
    const categorySelect = screen.getByLabelText("Categoría");
    await waitFor(() => expect(categorySelect).not.toBeDisabled());
    await user.selectOptions(categorySelect, "Lugar");
    fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-09-23" } });
    await user.click(screen.getByRole("button", { name: "2 h" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    // De vuelta en la stage de plan inicial del wizard (el modal de la gestión ya cerró).
    expect(await within(wizardDialog).findByRole("cell", { name: "Reservar salón" })).toBeInTheDocument();

    await user.click(within(wizardDialog).getByRole("button", { name: "Finalizar" }));

    // El wizard ya cerró: el selector de Hoy debería mostrar el evento recién
    // creado (no "Todos los eventos"), y la gestión agregada en el plan
    // inicial debería verse en la columna correspondiente.
    expect(await screen.findByRole("button", { name: "Cumpleaños de Ana" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Reservar salón")).toBeInTheDocument();
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
      if (href.includes("/hoy/")) {
        return Promise.resolve(jsonResponse(buildTodaySummary(subtasks, eventIdFromHoyUrl(href)), 200));
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
        <AuthProvider><HomePage /></AuthProvider>
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

  test("por defecto se ve la vista 'Hoy' con las columnas", async () => {
    stubHomepageFetch();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText("Vencida A");

    expect(screen.getByRole("heading", { name: "Viendo gestiones de:" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Hoy" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Próximos 7 días" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Para Hoy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vencidas" })).toBeInTheDocument();
  });

  test("la pestaña Eventos muestra las cards de eventos y oculta las columnas de Hoy", async () => {
    stubHomepageFetch();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );
    await screen.findByText("Vencida A");

    await user.click(screen.getByRole("tab", { name: "Eventos" }));

    // La card del evento (botón con su nombre) reemplaza al placeholder viejo.
    expect(await screen.findByRole("button", { name: /Boda Luisa & Carlos/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Próximos 7 días" })).not.toBeInTheDocument();
    expect(document.getElementById("hoy-panel")).toHaveAttribute("hidden");
  });

  test("volver a 'Hoy' desde Eventos conserva el evento seleccionado", async () => {
    stubHomepageFetch();
    const user = userEvent.setup();
    // Muestra la query string actual para poder leerla desde el test.
    function LocationProbe() {
      return <output data-testid="location-search">{useLocation().search}</output>;
    }
    const currentParams = () => new URLSearchParams(screen.getByTestId("location-search").textContent ?? "");

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
        <LocationProbe />
      </MemoryRouter>
    );
    await screen.findByText("Vencida A");

    await user.click(screen.getByRole("tab", { name: "Eventos" }));
    await screen.findByRole("button", { name: /Boda Luisa & Carlos/ });
    // Cambiar de vista no pisa ?evento= en la URL.
    expect(currentParams().get("evento")).toBe("1");
    expect(currentParams().get("vista")).toBe("eventos");

    await user.click(screen.getByRole("tab", { name: "Hoy" }));

    expect(await screen.findByText("Vencida A")).toBeInTheDocument();
    expect(currentParams().get("evento")).toBe("1");
    // "Hoy" es la vista por defecto: al volver a ella, ?vista= se limpia de la URL.
    expect(currentParams().get("vista")).toBeNull();
  });

  test("un ?vista= inválido cae en Hoy", async () => {
    stubHomepageFetch();

    render(
      <MemoryRouter initialEntries={["/?evento=1&vista=xyz"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: "Hoy" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Vencida A")).toBeInTheDocument();
  });

  test("?vista=eventos en la URL abre directamente la pestaña Eventos", async () => {
    stubHomepageFetch();

    render(
      <MemoryRouter initialEntries={["/?evento=1&vista=eventos"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: "Eventos" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("button", { name: /Boda Luisa & Carlos/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Próximos 7 días" })).not.toBeInTheDocument();
  });

  test("clickear una card en Eventos muestra la vista expandida del evento", async () => {
    stubHomepageFetch();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?vista=eventos"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    const card = await screen.findByRole("button", { name: /Boda Luisa & Carlos/ });
    await user.click(card);

    // Sigue en la pestaña Eventos: ya no salta a Hoy (eso era el puente temporal).
    expect(screen.getByRole("tab", { name: "Eventos" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Boda Luisa & Carlos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Borrar" })).toBeInTheDocument();
  });

  test("desde la vista expandida de Eventos, Editar abre el formulario y Borrar el diálogo de confirmación", async () => {
    stubHomepageFetch();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?vista=eventos"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole("button", { name: /Boda Luisa & Carlos/ }));

    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(await screen.findByRole("dialog", { name: "Editar evento" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await user.click(screen.getByRole("button", { name: "Borrar" }));
    expect(await screen.findByRole("alertdialog", { name: "Eliminar evento" })).toBeInTheDocument();
  });

  test("clickear una gestión en las tablas de Eventos abre su detalle, y Editar funciona sin depender del filtro de Hoy", async () => {
    stubHomepageFetch();
    const user = userEvent.setup();

    // Sin ?evento=: selectedEvent (el filtro de la pestaña Hoy) es null. Antes
    // del fix, esto hacía que "Editar" no abriera nada (SubtaskFormModal
    // dependía de selectedEvent en vez de resolver el evento por el eid de
    // la propia gestión).
    render(
      <MemoryRouter initialEntries={["/?vista=eventos"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole("button", { name: /Boda Luisa & Carlos/ }));

    const row = await screen.findByRole("row", { name: "Vencida A" });
    await user.click(row);

    const detailDialog = await screen.findByRole("dialog", { name: "Vencida A" });
    await user.click(within(detailDialog).getByRole("button", { name: "Editar" }));
    expect(await screen.findByRole("dialog", { name: "Editar gestión" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Vencida A");
  });

  test("sin eventos, la pestaña Eventos solo muestra el mensaje y el botón de crear", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/eventos/")) {
        return Promise.resolve(jsonResponse([], 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/?vista=eventos"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    // El texto está partido por un <br/> (dos líneas en el mismo <p>): exact:false
    // hace match por substring contra el texto combinado del elemento.
    expect(await screen.findByText("Aún no tienes eventos", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear nuevo evento" })).toBeInTheDocument();
  });

  test("PIM1-59: cambiar de evento rápido aborta con AbortController la carga anterior de /hoy/", async () => {
    const user = userEvent.setup();
    const event2: Event = { ...event, eid: 2, name: "Cumpleaños de Ana" };

    const hoyCalls: { eventId: number | null; signal?: AbortSignal; resolve: (response: Response) => void }[] = [];

    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      if (href.includes("/hoy/")) {
        return new Promise<Response>((resolve, reject) => {
          const signal = options?.signal as AbortSignal | undefined;
          hoyCalls.push({ eventId: eventIdFromHoyUrl(href), signal, resolve });
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      }
      if (href.includes("/eventos/")) {
        return Promise.resolve(jsonResponse([event, event2], 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(hoyCalls).toHaveLength(1));
    const firstCall = hoyCalls[0];
    expect(firstCall.eventId).toBe(1);
    expect(firstCall.signal?.aborted).toBe(false);

    // Cambia de evento antes de que la primera carga de /hoy/ resuelva.
    await user.click(await screen.findByRole("button", { name: "Boda Luisa & Carlos" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Cumpleaños de Ana" }));

    await waitFor(() => expect(hoyCalls).toHaveLength(2));
    expect(firstCall.signal?.aborted).toBe(true);
    const secondCall = hoyCalls[1];
    expect(secondCall.eventId).toBe(2);

    // La primera (ya abortada) resuelve tarde con datos del evento 1: no debe pintarse.
    firstCall.resolve(jsonResponse(buildTodaySummary(subtasks, 1), 200));
    secondCall.resolve(jsonResponse(buildTodaySummary([], 2), 200));

    await waitFor(() =>
      expect(screen.getByText(/Aún no has agregado/)).toBeInTheDocument()
    );
    expect(screen.queryByText("Hoy A")).not.toBeInTheDocument();
    // El abort no debe pintarse como un error de carga.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("sin eventos, la pestaña Hoy también oculta selector/filtros y solo muestra 'Crear Evento'", async () => {
    const emptyToday: TodaySummary = {
      fecha: TODAY,
      metrica: "gestiones",
      vencidas: [],
      para_hoy: { pendientes: [], completadas: [] },
      proximas: [],
      progreso_dia: { completadas: 0, total: 0, horas_completadas: "0", horas_totales: "0" },
      filtros: { event_id: null, status: null },
    };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/eventos/")) {
        return Promise.resolve(jsonResponse([], 200));
      }
      if (String(url).includes("/hoy/")) {
        return Promise.resolve(jsonResponse(emptyToday, 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Aún no tienes eventos", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear Evento" })).toBeInTheDocument();
    // Antes de la corrección, el botón decía "Crear gestión" y en realidad
    // creaba un evento primero (justo la confusión que señaló el profesor).
    expect(screen.queryByRole("button", { name: /Crear gestión/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filtros de gestiones")).not.toBeInTheDocument();
    expect(screen.queryByText("Viendo gestiones de:")).not.toBeInTheDocument();
  });

  test("PIM1-11: el selector de vistas vive en el header y el label de fecha vieja ya no existe", async () => {
    stubHomepageFetch();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText("Vencida A");

    const tablist = screen.getByRole("tablist", { name: "Vistas" });
    const header = tablist.closest("header");
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByText("PlanificApp")).toBeInTheDocument();
    expect(screen.queryByText("17 sep. 2026")).not.toBeInTheDocument();
  });

  test("PIM1-11: el ícono de Vencidas es el prominente, no el de Próximas", async () => {
    stubHomepageFetch();

    const { container } = render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText("Vencida A");

    const vencidasIcon = screen
      .getByRole("heading", { name: "Vencidas" })
      .closest(".column-title")
      ?.querySelector(".clock-icon");
    const proximasIcon = screen
      .getByRole("heading", { name: "Próximos 7 días" })
      .closest(".column-title")
      ?.querySelector(".clock-icon");

    expect(vencidasIcon).toHaveClass("clock-icon--urgent");
    expect(proximasIcon).not.toHaveClass("clock-icon--urgent");
    expect(container.querySelectorAll(".clock-icon--muted")).toHaveLength(0);
  });

  test("PIM1-11: cada card de gestión muestra el nombre del evento como botón", async () => {
    stubHomepageFetch();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText("Vencida A");

    // Una gestión de cada columna (Vencidas, Para Hoy, Próximas) basta para
    // confirmar que el label se propagó a las tres, no solo a una.
    const vencidaCard = screen.getByRole("button", { name: "Vencida A" });
    const hoyCard = screen.getByRole("button", { name: "Hoy A" });
    const proximaCard = screen.getByRole("button", { name: "Próxima A" });

    for (const card of [vencidaCard, hoyCard, proximaCard]) {
      expect(within(card).getByText("Evento:")).toBeInTheDocument();
      expect(within(card).getByRole("button", { name: "Boda Luisa & Carlos" })).toBeInTheDocument();
    }
  });

  test("PIM1-11: clickear el nombre del evento en una card no abre el detalle de la gestión", async () => {
    const user = userEvent.setup();
    stubHomepageFetch();

    render(
      <MemoryRouter initialEntries={["/?evento=1"]}>
        <AuthProvider><HomePage /></AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText("Vencida A");

    const vencidaCard = screen.getByRole("button", { name: "Vencida A" });
    await user.click(within(vencidaCard).getByRole("button", { name: "Boda Luisa & Carlos" }));

    // Sin destino todavía (HU-13 no existe): el click no hace nada visible,
    // pero sobre todo NO debe abrir el popup de detalle de la gestión.
    expect(screen.queryByRole("dialog", { name: "Vencida A" })).not.toBeInTheDocument();
  });
});
