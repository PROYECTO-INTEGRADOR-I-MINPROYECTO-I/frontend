import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EventsView } from "./events-view";
import type { Event, Subtask } from "../lib/types";

const event: Event = {
  eid: 1,
  user: 1,
  name: "Boda Luisa & Carlos",
  description: "",
  due_date: "2026-12-01T16:00:00.000Z",
  status: "pending",
  progress_percentage: 0,
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EventsView", () => {
  test("status loading muestra el mensaje de carga", () => {
    render(
      <EventsView
        events={[]}
        status="loading"
        errorMessage=""
        onRetry={vi.fn()}
        onCreateEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );
    expect(screen.getByText("Cargando eventos…")).toBeInTheDocument();
  });

  test("status error muestra el mensaje y el botón Reintentar", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <EventsView
        events={[]}
        status="error"
        errorMessage="No pudimos cargar tus eventos."
        onRetry={onRetry}
        onCreateEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar tus eventos.");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("sin eventos, solo muestra el mensaje y la card de crear", async () => {
    const user = userEvent.setup();
    const onCreateEvent = vi.fn();
    render(
      <EventsView
        events={[]}
        status="ready"
        errorMessage=""
        onRetry={vi.fn()}
        onCreateEvent={onCreateEvent}
        onEditEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );

    expect(screen.getByText("Aún no tienes eventos", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear nuevo evento" }));
    expect(onCreateEvent).toHaveBeenCalledTimes(1);
  });

  test("con eventos, la card de 'Crear nuevo evento' siempre está primero en el roulette", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    render(
      <EventsView
        events={[event]}
        status="ready"
        errorMessage=""
        onRetry={vi.fn()}
        onCreateEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Crear nuevo evento");
  });

  test("con eventos, pide las gestiones y el tipo, y pinta el progreso + resumen en su card", async () => {
    const subtasks = [
      subtask({ subtask_id: 1, title: "Reservar salón", status: "done" }),
      subtask({ subtask_id: 2, title: "Confirmar catering", status: "pending", scheduled_date: "2026-09-25" }),
    ];
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/tipos-evento/")) {
        return Promise.resolve(jsonResponse([{ id: 1, name: "Boda" }]));
      }
      if (href.includes("/eventos/1/subtareas/")) {
        return Promise.resolve(jsonResponse(subtasks));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EventsView
        events={[{ ...event, event_type: 1 }]}
        status="ready"
        errorMessage=""
        onRetry={vi.fn()}
        onCreateEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText("1 de 2 gestiones completadas")).toBeInTheDocument());
    expect(screen.getByText("Boda")).toBeInTheDocument();
    expect(screen.getByText("Confirmar catering")).toBeInTheDocument();
  });

  test("si /tipos-evento/ falla (404), la card se muestra igual sin el chip de tipo", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/tipos-evento/")) return Promise.resolve(new Response(null, { status: 404 }));
      if (href.includes("/eventos/1/subtareas/")) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EventsView
        events={[{ ...event, event_type: 1 }]}
        status="ready"
        errorMessage=""
        onRetry={vi.fn()}
        onCreateEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );

    expect(await screen.findByRole("button", { name: /Boda Luisa & Carlos/ })).toBeInTheDocument();
    expect(screen.queryByText("Boda")).not.toBeInTheDocument();
  });

  test("clickear una card muestra la vista expandida del evento, y 'Volver a Eventos' regresa al roulette", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    render(
      <EventsView
        events={[event]}
        status="ready"
        errorMessage=""
        onRetry={vi.fn()}
        onCreateEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );

    await user.click(await screen.findByRole("button", { name: /Boda Luisa & Carlos/ }));

    expect(screen.getByRole("heading", { name: "Boda Luisa & Carlos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Borrar" })).toBeInTheDocument();
    // El roulette ya no está mientras se ve el detalle.
    expect(screen.queryByRole("button", { name: "Crear nuevo evento" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Volver a Eventos" }));

    expect(screen.getByRole("button", { name: "Crear nuevo evento" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Boda Luisa & Carlos" })).not.toBeInTheDocument();
  });

  test("en la vista expandida, Editar y Borrar llaman a onEditEvent/onDeleteEvent con el evento", async () => {
    const user = userEvent.setup();
    const onEditEvent = vi.fn();
    const onDeleteEvent = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    render(
      <EventsView
        events={[event]}
        status="ready"
        errorMessage=""
        onRetry={vi.fn()}
        onCreateEvent={vi.fn()}
        onEditEvent={onEditEvent}
        onDeleteEvent={onDeleteEvent}
      />
    );

    await user.click(await screen.findByRole("button", { name: /Boda Luisa & Carlos/ }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEditEvent).toHaveBeenCalledWith(event);

    await user.click(screen.getByRole("button", { name: "Borrar" }));
    expect(onDeleteEvent).toHaveBeenCalledWith(event);
  });
});
