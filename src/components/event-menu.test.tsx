import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { EventMenu } from "./event-menu";
import type { Event } from "../lib/types";

const event: Event = {
  eid: 1,
  user: 1,
  name: "Boda Luisa & Carlos",
  description: "",
  due_date: "2026-12-01T16:00:00.000Z",
  status: "pending",
  progress_percentage: 0,
  created_at: "2026-01-01T00:00:00.000Z",
};

function renderMenu(overrides: Partial<React.ComponentProps<typeof EventMenu>> = {}) {
  return render(
    <EventMenu
      events={[event]}
      status="ready"
      errorMessage=""
      onRetry={vi.fn()}
      selectedEventId={null}
      onSelect={vi.fn()}
      onCreateNew={vi.fn()}
      onEditEvent={vi.fn()}
      onDeleteEvent={vi.fn()}
      {...overrides}
    />
  );
}

describe("EventMenu", () => {
  test("el disparador se ve como texto subrayado del mismo tamaño que el heading, sin fondo ni borde propio (corrección de la clínica)", () => {
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Todos los eventos" });
    expect(trigger.className).toContain("underline");
    expect(trigger.className).toContain("text-[32px]");
    // Estilo viejo (pill con fondo): ya no debería quedar nada de esto.
    expect(trigger.className).not.toContain("rounded-full");
    expect(trigger.className).not.toContain("bg-white");
    expect(trigger.className).not.toContain("border");
    expect(trigger.className).not.toContain("shadow-sm");
  });

  test("gana más peso (negrilla) al pasar el mouse", () => {
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Todos los eventos" });
    expect(trigger.className).toContain("hover:font-semibold");
  });

  test("muestra el nombre del evento seleccionado en vez de 'Todos los eventos'", () => {
    renderMenu({ selectedEventId: 1 });

    expect(screen.getByRole("button", { name: "Boda Luisa & Carlos" })).toBeInTheDocument();
  });

  test("sigue abriendo el menú al clickear, sin importar el nuevo estilo", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Todos los eventos" }));

    expect(screen.getByRole("menu", { name: "Eventos" })).toBeInTheDocument();
  });
});
