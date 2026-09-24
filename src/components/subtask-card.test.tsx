import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { SubtaskCard } from "./subtask-card";
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

describe("SubtaskCard", () => {
  test("muestra título, categoría, horas y fecha, sin badge de prioridad", () => {
    render(<SubtaskCard subtask={subtask} onOpen={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Confirmar catering" })).toBeInTheDocument();
    expect(screen.getByText("Catering")).toBeInTheDocument();
    expect(screen.getByText("2 h 30 min")).toBeInTheDocument();
    expect(screen.getByText("19 sept")).toBeInTheDocument();

    expect(screen.queryByText(/baja|media|alta|urgente/i)).not.toBeInTheDocument();
  });

  test("vencida muestra el aviso 'Requiere acción'", () => {
    render(<SubtaskCard subtask={subtask} onOpen={vi.fn()} overdue />);

    expect(screen.getByText("Requiere acción")).toBeInTheDocument();
  });

  test("completada muestra la marca 'Completada'", () => {
    render(<SubtaskCard subtask={subtask} onOpen={vi.fn()} completed />);

    expect(screen.getByText("Completada")).toBeInTheDocument();
  });

  test("sin onToggleComplete no se pinta el checkbox", () => {
    render(<SubtaskCard subtask={subtask} onOpen={vi.fn()} />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  test("el checkbox refleja el estado y llama a onToggleComplete sin abrir el detalle", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onToggleComplete = vi.fn();
    render(<SubtaskCard subtask={subtask} onOpen={onOpen} onToggleComplete={onToggleComplete} />);

    const checkbox = screen.getByRole("checkbox", { name: "Marcar Confirmar catering como completada" });
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    await user.click(checkbox);

    expect(onToggleComplete).toHaveBeenCalledWith(subtask);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("una gestión completada muestra el checkbox marcado y se puede desmarcar", async () => {
    const user = userEvent.setup();
    const onToggleComplete = vi.fn();
    const done: Subtask = { ...subtask, status: "done" };
    render(<SubtaskCard subtask={done} onOpen={vi.fn()} onToggleComplete={onToggleComplete} completed />);

    const checkbox = screen.getByRole("checkbox", { name: "Marcar Confirmar catering como completada" });
    expect(checkbox).toHaveAttribute("aria-checked", "true");

    await user.click(checkbox);

    expect(onToggleComplete).toHaveBeenCalledWith(done);
  });

  test("el checkbox se deshabilita mientras `pending` es true", () => {
    render(<SubtaskCard subtask={subtask} onOpen={vi.fn()} onToggleComplete={vi.fn()} pending />);

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
