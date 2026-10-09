import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SubtaskDetailModal } from "./subtask-detail-modal";
import type { Subtask } from "../lib/types";

const subtask: Subtask = {
  subtask_id: 1,
  eid: 1,
  title: "Confirmar catering",
  description: "Cerrar el menú definitivo.",
  category: "Catering",
  estimated_hours: "2.5",
  scheduled_date: "2026-09-19",
  status: "pending",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 19, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SubtaskDetailModal", () => {
  test("gestión pendiente muestra el botón 'Marcar como completada'", () => {
    render(
      <SubtaskDetailModal
        subtask={subtask}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleComplete={vi.fn()}
        onReprogram={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Marcar como completada" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como pendiente" })).not.toBeInTheDocument();
  });

  test("gestión completada muestra el botón 'Marcar como pendiente'", () => {
    render(
      <SubtaskDetailModal
        subtask={{ ...subtask, status: "done" }}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleComplete={vi.fn()}
        onReprogram={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Marcar como pendiente" })).toBeInTheDocument();
  });

  test("el botón llama a onToggleComplete con la gestión actual", async () => {
    const user = userEvent.setup();
    const onToggleComplete = vi.fn();
    render(
      <SubtaskDetailModal
        subtask={subtask}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleComplete={onToggleComplete}
        onReprogram={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Marcar como completada" }));

    expect(onToggleComplete).toHaveBeenCalledWith(subtask);
  });

  test("Editar y Borrar son botones dedicados que llaman a onEdit/onDelete con la gestión actual", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <SubtaskDetailModal
        subtask={subtask}
        onClose={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleComplete={vi.fn()}
        onReprogram={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledWith(subtask);

    await user.click(screen.getByRole("button", { name: "Borrar" }));
    expect(onDelete).toHaveBeenCalledWith(subtask);
  });

  test("togglePending deshabilita el botón", () => {
    render(
      <SubtaskDetailModal
        subtask={subtask}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleComplete={vi.fn()}
        onReprogram={vi.fn()}
        togglePending
      />
    );

    expect(screen.getByRole("button", { name: "Marcar como completada" })).toBeDisabled();
  });

  test("toggleError muestra el mensaje y el botón Reintentar dentro del modal", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <SubtaskDetailModal
        subtask={subtask}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleComplete={vi.fn()}
        onReprogram={vi.fn()}
        toggleError={{ message: "Sin conexión. No se guardó el cambio.", onRetry }}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sin conexión. No se guardó el cambio.");

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalled();
  });

  test("'Reprogramar' vive debajo de 'Marcar como completada' y llama a onReprogram con la gestión actual", async () => {
    const user = userEvent.setup();
    const onReprogram = vi.fn();
    render(
      <SubtaskDetailModal
        subtask={subtask}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleComplete={vi.fn()}
        onReprogram={onReprogram}
      />
    );

    const footer = screen.getByRole("button", { name: "Marcar como completada" }).parentElement;
    const buttons = within(footer as HTMLElement).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Marcar como completada",
      "Reprogramar",
      "Editar",
      "Borrar",
    ]);

    await user.click(screen.getByRole("button", { name: "Reprogramar" }));

    expect(onReprogram).toHaveBeenCalledWith(subtask);
  });
});
