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
        onOpenSubtask={vi.fn()}
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
        onOpenSubtask={vi.fn()}
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
        onOpenSubtask={vi.fn()}
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
        onOpenSubtask={vi.fn()}
      />
    );

    expect(within(groupPanel("Vencidas")).getByText("- 2 GESTIONES")).toBeInTheDocument();
    expect(within(groupPanel("Para hoy")).getByText("- 0 GESTIONES")).toBeInTheDocument();
  });

  test("clickear el nombre de un grupo colapsa su tabla y gira la flecha de expandido/colapsado", async () => {
    const user = userEvent.setup();
    render(
      <EventDetailView
        event={event}
        subtasks={[subtask({ subtask_id: 1, scheduled_date: "2026-09-18" })]}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenSubtask={vi.fn()}
      />
    );

    const vencidas = groupPanel("Vencidas");
    const arrow = vencidas.querySelector("svg") as SVGElement;
    expect(vencidas).toHaveAttribute("open");
    expect(arrow.getAttribute("class")).not.toContain("rotate-180");

    await user.click(screen.getByText("Vencidas"));

    expect(vencidas).not.toHaveAttribute("open");
    expect(arrow.getAttribute("class")).toContain("rotate-180");
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
        onOpenSubtask={vi.fn()}
      />
    );

    expect(within(groupPanel("Vencidas")).getByText("Sin gestiones vencidas.")).toBeInTheDocument();
    expect(within(groupPanel("Vencidas")).queryByRole("table")).not.toBeInTheDocument();
  });

  test("el filtro por tipo se muestra aunque el grupo solo tenga una categoría (para que sea descubrible)", () => {
    render(
      <EventDetailView
        event={event}
        subtasks={[subtask({ subtask_id: 1, scheduled_date: "2026-09-18", category: "Lugar" })]}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenSubtask={vi.fn()}
      />
    );

    const select = within(groupPanel("Vencidas")).getByLabelText("Tipo");
    expect(select).toBeInTheDocument();
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["Todos", "Lugar"]);
  });

  test("el filtro por tipo de cada tabla solo muestra las gestiones de la categoría elegida", async () => {
    const user = userEvent.setup();
    const subtasks = [
      subtask({ subtask_id: 1, title: "Reservar salón", scheduled_date: "2026-09-18", category: "Lugar" }),
      subtask({ subtask_id: 2, title: "Confirmar catering", scheduled_date: "2026-09-17", category: "Catering" }),
    ];

    render(
      <EventDetailView
        event={event}
        subtasks={subtasks}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenSubtask={vi.fn()}
      />
    );

    const vencidasPanel = within(groupPanel("Vencidas"));
    expect(vencidasPanel.getByText("- 2 GESTIONES")).toBeInTheDocument();
    expect(vencidasPanel.getByText("Reservar salón")).toBeInTheDocument();
    expect(vencidasPanel.getByText("Confirmar catering")).toBeInTheDocument();

    await user.selectOptions(vencidasPanel.getByLabelText("Tipo"), "Catering");

    expect(vencidasPanel.getByText("- 1 GESTIONES")).toBeInTheDocument();
    expect(vencidasPanel.getByText("Confirmar catering")).toBeInTheDocument();
    expect(vencidasPanel.queryByText("Reservar salón")).not.toBeInTheDocument();

    // Otro grupo (Próximas, vacío) no se ve afectado por el filtro de Vencidas.
    expect(within(groupPanel("Próximas")).getByText("Sin gestiones próximas.")).toBeInTheDocument();
  });

  test("si la categoría elegida ya no tiene gestiones tras refrescar, el filtro vuelve solo a 'Todos' en vez de dejar la tabla vacía sin salida", async () => {
    const user = userEvent.setup();
    const withCatering = [
      subtask({ subtask_id: 1, title: "Reservar salón", scheduled_date: "2026-09-18", category: "Lugar" }),
      subtask({ subtask_id: 2, title: "Confirmar catering", scheduled_date: "2026-09-17", category: "Catering" }),
    ];

    const { rerender } = render(
      <EventDetailView
        event={event}
        subtasks={withCatering}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenSubtask={vi.fn()}
      />
    );

    await user.selectOptions(within(groupPanel("Vencidas")).getByLabelText("Tipo"), "Catering");

    // La gestión de catering se completa (o se elimina) en otra pestaña: el
    // refetch por refreshToken trae un `subtasks` donde Vencidas ya no tiene
    // ninguna de categoría "Catering", pero el filtro sigue eligiéndola.
    rerender(
      <EventDetailView
        event={event}
        subtasks={[subtask({ subtask_id: 1, title: "Reservar salón", scheduled_date: "2026-09-18", category: "Lugar" })]}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenSubtask={vi.fn()}
      />
    );

    const vencidasPanel = within(groupPanel("Vencidas"));
    // No quedó "atascada" filtrada por una categoría que ya no existe: el
    // select vuelve a "Todos" y la fila restante se ve de nuevo.
    expect(vencidasPanel.getByLabelText("Tipo")).toHaveValue("all");
    expect(vencidasPanel.getByText("Reservar salón")).toBeInTheDocument();
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
        onOpenSubtask={vi.fn()}
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
        onOpenSubtask={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Volver a Eventos" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Borrar" }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("clickear una fila de gestión llama a onOpenSubtask con esa gestión", async () => {
    const user = userEvent.setup();
    const onOpenSubtask = vi.fn();
    const targetSubtask = subtask({ subtask_id: 7, title: "Confirmar catering", scheduled_date: "2026-09-18" });

    render(
      <EventDetailView
        event={event}
        subtasks={[targetSubtask]}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenSubtask={onOpenSubtask}
      />
    );

    await user.click(screen.getByRole("row", { name: "Confirmar catering" }));
    expect(onOpenSubtask).toHaveBeenCalledWith(targetSubtask);
  });

  test("Enter y Espacio sobre una fila enfocada también llaman a onOpenSubtask", async () => {
    const user = userEvent.setup();
    const onOpenSubtask = vi.fn();
    const targetSubtask = subtask({ subtask_id: 7, title: "Confirmar catering", scheduled_date: "2026-09-18" });

    render(
      <EventDetailView
        event={event}
        subtasks={[targetSubtask]}
        subtasksLoading={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenSubtask={onOpenSubtask}
      />
    );

    const row = screen.getByRole("row", { name: "Confirmar catering" });
    row.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onOpenSubtask).toHaveBeenCalledTimes(2);
  });
});
