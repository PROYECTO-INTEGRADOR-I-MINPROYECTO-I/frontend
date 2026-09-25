import { render, screen } from "@testing-library/react";
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
      />
    );

    await user.click(screen.getByRole("button", { name: "Marcar como completada" }));

    expect(onToggleComplete).toHaveBeenCalledWith(subtask);
  });

  test("togglePending deshabilita el botón", () => {
    render(
      <SubtaskDetailModal
        subtask={subtask}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleComplete={vi.fn()}
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
        toggleError={{ message: "Sin conexión. No se guardó el cambio.", onRetry }}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sin conexión. No se guardó el cambio.");

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalled();
  });
});
