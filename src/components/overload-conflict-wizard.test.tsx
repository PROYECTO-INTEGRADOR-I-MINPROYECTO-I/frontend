import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { OverloadConflictWizard } from "./overload-conflict-wizard";
import type { ConflictInfo } from "../lib/daily-capacity";

const conflict: ConflictInfo = {
  date: "2026-10-10",
  existingHours: 5,
  plannedHours: 7,
  limit: 6,
};

describe("OverloadConflictWizard", () => {
  test("stage 1 muestra las cifras exactas del conflicto", () => {
    render(
      <OverloadConflictWizard
        open
        conflict={conflict}
        moveSuggestion="2026-10-11"
        maxReduceHours={1}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("¡Esta reprogramación supera tu límite diario!")).toBeInTheDocument();
    expect(screen.getByText("10 oct")).toBeInTheDocument();
    expect(screen.getByText("5 horas")).toBeInTheDocument();
    expect(screen.getByText(/7 horas/)).toBeInTheDocument();
    expect(screen.getByText(/límite 6 horas/)).toBeInTheDocument();
  });

  test("'Ver opciones de solución' avanza a la stage 2 con las dos alternativas", async () => {
    const user = userEvent.setup();
    render(
      <OverloadConflictWizard
        open
        conflict={conflict}
        moveSuggestion="2026-10-11"
        maxReduceHours={1}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Ver opciones de solución" }));

    expect(screen.getByText("Opción 1: Reprogramar para 11 oct")).toBeInTheDocument();
    expect(screen.getByText("Opción 2: Reducir duración de la gestión a 1 horas")).toBeInTheDocument();
  });

  test("las dos opciones son excluyentes entre sí", async () => {
    const user = userEvent.setup();
    render(
      <OverloadConflictWizard
        open
        conflict={conflict}
        moveSuggestion="2026-10-11"
        maxReduceHours={1}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Ver opciones de solución" }));

    const moveOption = screen.getByRole("button", { name: "Opción 1: Reprogramar para 11 oct" });
    const reduceOption = screen.getByRole("button", { name: "Opción 2: Reducir duración de la gestión a 1 horas" });

    await user.click(moveOption);
    expect(moveOption).toHaveAttribute("aria-pressed", "true");
    expect(reduceOption).toHaveAttribute("aria-pressed", "false");

    await user.click(reduceOption);
    expect(moveOption).toHaveAttribute("aria-pressed", "false");
    expect(reduceOption).toHaveAttribute("aria-pressed", "true");
  });

  test("Confirmar está deshabilitado sin selección, y manda la resolución elegida", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <OverloadConflictWizard
        open
        conflict={conflict}
        moveSuggestion="2026-10-11"
        maxReduceHours={1}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole("button", { name: "Ver opciones de solución" }));

    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Opción 1: Reprogramar para 11 oct" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(onConfirm).toHaveBeenCalledWith({ type: "move", date: "2026-10-11" });
  });

  test("'Ir atrás' en cualquier stage vuelve directo al form original (no a la stage 1)", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <OverloadConflictWizard
        open
        conflict={conflict}
        moveSuggestion="2026-10-11"
        maxReduceHours={1}
        onBack={onBack}
        onConfirm={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Ver opciones de solución" }));
    await user.click(screen.getByRole("button", { name: "Ir atrás" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test("opción deshabilitada cuando no hay sugerencia de mover o de reducir, con el label en rojo", async () => {
    const user = userEvent.setup();
    render(
      <OverloadConflictWizard
        open
        conflict={conflict}
        moveSuggestion={null}
        maxReduceHours={null}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Ver opciones de solución" }));

    expect(
      screen.getByText("No encontramos un día disponible entre hoy y la fecha del evento.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("El día al que planeas ya está en su límite diario. No caben más gestiones.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Opción 1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Opción 2/ })).not.toBeInTheDocument();
  });
});
