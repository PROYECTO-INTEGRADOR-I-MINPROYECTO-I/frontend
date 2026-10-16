import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { EventProgressBar } from "./event-progress-bar";
import type { Subtask } from "../lib/types";

let nextId = 1;
function subtask(status: Subtask["status"], hours = "1"): Subtask {
  return {
    subtask_id: nextId++,
    eid: 1,
    title: "Gestión",
    description: "",
    category: "Lugar",
    estimated_hours: hours,
    scheduled_date: "2026-09-20",
    status,
  };
}

describe("EventProgressBar", () => {
  test("muestra porcentaje y conteos por estado", () => {
    render(
      <EventProgressBar
        subtasks={[subtask("done"), subtask("postponed"), subtask("pending"), subtask("pending")]}
      />
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("1 completada")).toBeInTheDocument();
    expect(screen.getByText("1 pospuesta")).toBeInTheDocument();
    expect(screen.getByText("2 pendientes")).toBeInTheDocument();
  });

  test("en modo Horas suma estimated_hours", async () => {
    render(<EventProgressBar subtasks={[subtask("done", "2.5"), subtask("pending", "7.5")]} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Horas" }));

    expect(screen.getByText("2.5 h de 10 h")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  test("al 100% muestra el mensaje de evento listo", () => {
    render(<EventProgressBar subtasks={[subtask("done"), subtask("done")]} />);

    expect(screen.getByText(/Evento listo/)).toBeInTheDocument();
  });

  test("sin gestiones no divide por cero", () => {
    render(<EventProgressBar subtasks={[]} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.queryByText(/Evento listo/)).not.toBeInTheDocument();
  });

  test("199/200 muestra 99% y no marca el evento como listo", () => {
    const items = [...Array.from({ length: 199 }, () => subtask("done")), subtask("pending")];
    render(<EventProgressBar subtasks={items} />);

    expect(screen.getByText("99%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "99");
    expect(screen.queryByText(/Evento listo/)).not.toBeInTheDocument();
  });
});
