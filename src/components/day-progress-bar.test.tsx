import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DayProgressBar } from "./day-progress-bar";
import type { DayProgress } from "../lib/types";

function progress(overrides: Partial<DayProgress>): DayProgress {
  return {
    completadas: 1,
    total: 3,
    horas_completadas: "2.00",
    horas_totales: "6.00",
    ...overrides,
  };
}

describe("DayProgressBar", () => {
  test("con total 0, muestra el mensaje en vez de la barra (nunca divide por cero)", () => {
    render(<DayProgressBar progress={progress({ completadas: 0, total: 0 })} metric="gestiones" onMetricChange={vi.fn()} />);

    expect(screen.getByText("No hay tareas asignadas para hoy.")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  test("con métrica 'gestiones', pinta el conteo y el porcentaje sobre completadas/total", () => {
    render(<DayProgressBar progress={progress({ completadas: 1, total: 4 })} metric="gestiones" onMetricChange={vi.fn()} />);

    expect(screen.getByText("1/4 gestiones para hoy completadas")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  test("con métrica 'horas', pinta las horas formateadas y el porcentaje sobre horas", () => {
    render(
      <DayProgressBar
        progress={progress({ horas_completadas: "3.00", horas_totales: "6.00" })}
        metric="horas"
        onMetricChange={vi.fn()}
      />
    );

    expect(screen.getByText("3 h/6 h horas para hoy completadas")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  test("clickear 'Horas'/'Gestiones' llama a onMetricChange sin volver a pedir datos (el toggle es local)", async () => {
    const user = userEvent.setup();
    const onMetricChange = vi.fn();
    render(<DayProgressBar progress={progress({})} metric="gestiones" onMetricChange={onMetricChange} />);

    await user.click(screen.getByRole("button", { name: "Horas" }));
    expect(onMetricChange).toHaveBeenCalledWith("horas");

    await user.click(screen.getByRole("button", { name: "Gestiones" }));
    expect(onMetricChange).toHaveBeenCalledWith("gestiones");
  });

  test("el botón de la métrica activa tiene aria-pressed true", () => {
    render(<DayProgressBar progress={progress({})} metric="horas" onMetricChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Horas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Gestiones" })).toHaveAttribute("aria-pressed", "false");
  });

  test("el toggle tiene su propio label 'Mostrar progreso en:'", () => {
    render(<DayProgressBar progress={progress({})} metric="gestiones" onMetricChange={vi.fn()} />);

    expect(screen.getByText("Mostrar progreso en:")).toBeInTheDocument();
  });
});
