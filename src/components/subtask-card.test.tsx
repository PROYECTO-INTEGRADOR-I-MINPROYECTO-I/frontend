import { render, screen } from "@testing-library/react";
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
});
