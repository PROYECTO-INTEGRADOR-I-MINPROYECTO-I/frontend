import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { EventCard } from "./event-card";
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
  event_type: 1,
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

const baseProps = {
  previewSubtasks: [] as Subtask[],
  previewMoreCount: 0,
};

describe("EventCard", () => {
  test("muestra el tipo, la fecha, el progreso y el contador de completadas", () => {
    render(
      <EventCard
        event={event}
        eventTypeName="Boda"
        completed={3}
        total={5}
        todayCount={0}
        onOpen={vi.fn()}
        onEventCoverUpdated={vi.fn()}
        {...baseProps}
      />
    );

    expect(screen.getByRole("button", { name: /Boda Luisa & Carlos/ })).toBeInTheDocument();
    expect(screen.getByText("Boda")).toBeInTheDocument();
    expect(screen.getByText("1 dic")).toBeInTheDocument();
    expect(screen.getByText("3 de 5 gestiones completadas")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    // La portada (EventCover) vive dentro de la card.
    expect(screen.getByRole("button", { name: "Cambiar portada del evento" })).toBeInTheDocument();
  });

  test("Enter y Espacio sobre la card enfocada también llaman a onOpen", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <EventCard event={event} completed={0} total={0} todayCount={0} onOpen={onOpen} onEventCoverUpdated={vi.fn()} {...baseProps} />
    );

    screen.getByRole("button", { name: /Boda Luisa & Carlos/ }).focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  test("sin gestiones (total 0) no muestra la barra de progreso", () => {
    render(
      <EventCard event={event} completed={0} total={0} todayCount={0} onOpen={vi.fn()} onEventCoverUpdated={vi.fn()} {...baseProps} />
    );

    expect(screen.getByText("Sin gestiones todavía.")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  test("mientras carga el progreso no muestra 0% engañoso", () => {
    render(
      <EventCard
        event={event}
        completed={0}
        total={0}
        todayCount={0}
        loading
        onOpen={vi.fn()}
        onEventCoverUpdated={vi.fn()}
        {...baseProps}
      />
    );

    expect(screen.getByText("Cargando progreso…")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  test("con gestiones para hoy, muestra el contador; en singular si es una sola", () => {
    render(
      <EventCard event={event} completed={0} total={2} todayCount={1} onOpen={vi.fn()} onEventCoverUpdated={vi.fn()} {...baseProps} />
    );
    expect(screen.getByText("1 gestión para hoy")).toBeInTheDocument();
  });

  test("muestra el resumen de próximas gestiones y el contador de las que no entraron", () => {
    render(
      <EventCard
        event={event}
        completed={0}
        total={5}
        todayCount={0}
        onOpen={vi.fn()}
        onEventCoverUpdated={vi.fn()}
        previewSubtasks={[subtask({ subtask_id: 1, title: "Reservar salón" }), subtask({ subtask_id: 2, title: "Confirmar catering" })]}
        previewMoreCount={2}
      />
    );

    expect(screen.getByText("Reservar salón")).toBeInTheDocument();
    expect(screen.getByText("Confirmar catering")).toBeInTheDocument();
    expect(screen.getByText("+2 más")).toBeInTheDocument();
  });

  test("sin tipo de evento, no muestra el chip de tipo", () => {
    render(
      <EventCard
        event={{ ...event, event_type: null }}
        completed={0}
        total={0}
        todayCount={0}
        onOpen={vi.fn()}
        onEventCoverUpdated={vi.fn()}
        {...baseProps}
      />
    );
    expect(screen.queryByText("Boda")).not.toBeInTheDocument();
  });

  test("clickear la card llama a onOpen", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <EventCard event={event} completed={0} total={0} todayCount={0} onOpen={onOpen} onEventCoverUpdated={vi.fn()} {...baseProps} />
    );

    await user.click(screen.getByRole("button", { name: /Boda Luisa & Carlos/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
