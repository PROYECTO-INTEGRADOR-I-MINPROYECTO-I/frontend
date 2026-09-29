import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EventDetailView } from "./event-detail-view";
import type { Event, Subtask } from "../lib/types";

const event: Event = {
  eid: 1,
  user: 1,
  name: "Boda Luisa & Carlos",
  description: "Ceremonia y recepción.",
  due_date: "2026-12-01T16:00:00.000Z",
  status: "pending",
  progress_percentage: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  place: "Salón Jardín",
  client_contact: "Luisa Pérez",
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

// "Hoy" fijo en 2026-09-20 para que vencida/próxima/hoy sean deterministas.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 20, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

function groupPanel(label: string): HTMLElement {
  return screen.getByText(label).closest("details") as HTMLElement;
}

describe("EventDetailView", () => {
  test("info del evento: tipo, fecha, lugar, contacto y descripción", () => {
    render(
      <EventDetailView
        event={event}
        eventTypeName="Boda"
        subtasks={[]}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Boda Luisa & Carlos" })).toBeInTheDocument();
    expect(screen.getByText("Boda")).toBeInTheDocument();
    expect(screen.getByText("1 dic")).toBeInTheDocument();
    expect(screen.getByText("Salón Jardín")).toBeInTheDocument();
    expect(screen.getByText("Luisa Pérez")).toBeInTheDocument();
    expect(screen.getByText("Ceremonia y recepción.")).toBeInTheDocument();
  });

  test("mientras cargan las gestiones, no muestra las 4 tablas", () => {
    render(
      <EventDetailView
        event={event}
        subtasks={[]}
        subtasksLoading
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Cargando gestiones…")).toBeInTheDocument();
    expect(screen.queryByText("Para hoy")).not.toBeInTheDocument();
  });

  test("cada gestión cae en el grupo correcto según su fecha y estado", () => {
    const subtasks = [
      subtask({ subtask_id: 1, title: "Vencida A", scheduled_date: "2026-09-18" }),
      subtask({ subtask_id: 2, title: "Hoy A", scheduled_date: "2026-09-20" }),
      subtask({ subtask_id: 3, title: "Próxima A", scheduled_date: "2026-09-25" }),
      subtask({ subtask_id: 4, title: "Completada A", scheduled_date: "2026-09-15", status: "done" }),
      // Una completada con fecha de hoy: va a "Completadas", no a "Para hoy".
      subtask({ subtask_id: 5, title: "Completada B", scheduled_date: "2026-09-20", status: "done" }),
    ];

    render(
      <EventDetailView
        event={event}
        subtasks={subtasks}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(within(groupPanel("Vencidas")).getByText("Vencida A")).toBeInTheDocument();
    expect(within(groupPanel("Para hoy")).getByText("Hoy A")).toBeInTheDocument();
    expect(within(groupPanel("Próximas")).getByText("Próxima A")).toBeInTheDocument();
    expect(within(groupPanel("Completadas")).getByText("Completada A")).toBeInTheDocument();
    expect(within(groupPanel("Completadas")).getByText("Completada B")).toBeInTheDocument();

    // No se filtran a otros grupos.
    expect(within(groupPanel("Para hoy")).queryByText("Completada B")).not.toBeInTheDocument();
    expect(within(groupPanel("Vencidas")).queryByText("Hoy A")).not.toBeInTheDocument();
  });

  test('el contador "- X GESTIONES" refleja cuántas hay en cada grupo', () => {
    const subtasks = [
      subtask({ subtask_id: 1, scheduled_date: "2026-09-18" }),
      subtask({ subtask_id: 2, scheduled_date: "2026-09-17" }),
    ];

    render(
      <EventDetailView
        event={event}
        subtasks={subtasks}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(within(groupPanel("Vencidas")).getByText("- 2 GESTIONES")).toBeInTheDocument();
    expect(within(groupPanel("Para hoy")).getByText("- 0 GESTIONES")).toBeInTheDocument();
  });

  test("un grupo vacío muestra su mensaje en vez de una tabla", () => {
    render(
      <EventDetailView
        event={event}
        subtasks={[]}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(within(groupPanel("Vencidas")).getByText("Sin gestiones vencidas.")).toBeInTheDocument();
    expect(within(groupPanel("Vencidas")).queryByRole("table")).not.toBeInTheDocument();
  });

  test("dentro de Vencidas, la fecha más antigua aparece primero", () => {
    const subtasks = [
      subtask({ subtask_id: 1, title: "Vencida reciente", scheduled_date: "2026-09-19" }),
      subtask({ subtask_id: 2, title: "Vencida antigua", scheduled_date: "2026-09-10" }),
    ];

    render(
      <EventDetailView
        event={event}
        subtasks={subtasks}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const rows = within(groupPanel("Vencidas")).getAllByRole("row");
    // rows[0] es el encabezado.
    expect(rows[1]).toHaveTextContent("Vencida antigua");
    expect(rows[2]).toHaveTextContent("Vencida reciente");
  });

  test("botones Editar y Borrar llaman a onEdit/onDelete; Volver llama a onBack", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <EventDetailView
        event={event}
        subtasks={[]}
        subtasksLoading={false}
        onBack={onBack}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole("button", { name: "Volver a Eventos" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Borrar" }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
