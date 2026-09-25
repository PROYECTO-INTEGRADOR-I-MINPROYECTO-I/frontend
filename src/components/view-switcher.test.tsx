import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { ViewSwitcher, type ViewSwitcherValue } from "./view-switcher";

function ControlledViewSwitcher({ initialValue = "plan" as ViewSwitcherValue }) {
  const [value, setValue] = useState<ViewSwitcherValue>(initialValue);
  return <ViewSwitcher value={value} onChange={setValue} />;
}

describe("ViewSwitcher", () => {
  test("expone role tablist con dos tabs, y la activa tiene aria-selected", () => {
    render(<ControlledViewSwitcher />);

    expect(screen.getByRole("tablist", { name: "Vistas" })).toBeInTheDocument();
    const planTab = screen.getByRole("tab", { name: "Plan inicial" });
    const hoyTab = screen.getByRole("tab", { name: "Hoy" });

    expect(planTab).toHaveAttribute("aria-selected", "true");
    expect(hoyTab).toHaveAttribute("aria-selected", "false");
  });

  test("hacer clic en una pestaña la selecciona", async () => {
    const user = userEvent.setup();
    render(<ControlledViewSwitcher />);

    await user.click(screen.getByRole("tab", { name: "Hoy" }));

    expect(screen.getByRole("tab", { name: "Hoy" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Plan inicial" })).toHaveAttribute("aria-selected", "false");
  });

  test("Fin e Inicio llevan la selección y el foco a la última y a la primera pestaña", async () => {
    const user = userEvent.setup();
    render(<ControlledViewSwitcher />);

    screen.getByRole("tab", { name: "Plan inicial" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Hoy" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Hoy" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Plan inicial" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Plan inicial" })).toHaveFocus();
  });

  test("la flecha derecha mueve la selección y el foco a la siguiente pestaña", async () => {
    const user = userEvent.setup();
    render(<ControlledViewSwitcher />);

    const planTab = screen.getByRole("tab", { name: "Plan inicial" });
    planTab.focus();
    await user.keyboard("{ArrowRight}");

    const hoyTab = screen.getByRole("tab", { name: "Hoy" });
    expect(hoyTab).toHaveAttribute("aria-selected", "true");
    expect(hoyTab).toHaveFocus();
  });

  test("la flecha izquierda da la vuelta (wrap) de la primera a la última pestaña", async () => {
    const user = userEvent.setup();
    render(<ControlledViewSwitcher />);

    const planTab = screen.getByRole("tab", { name: "Plan inicial" });
    planTab.focus();
    await user.keyboard("{ArrowLeft}");

    const hoyTab = screen.getByRole("tab", { name: "Hoy" });
    expect(hoyTab).toHaveAttribute("aria-selected", "true");
    expect(hoyTab).toHaveFocus();
  });
});
