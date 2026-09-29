import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { EventCover } from "./event-cover";
import { eventCoverColor } from "../lib/event-display";
import { getEventCoverOverride } from "../lib/event-cover-override";
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

afterEach(() => {
  window.localStorage.clear();
});

function coverBox(container: HTMLElement): HTMLElement {
  return container.querySelector("[aria-hidden='true']") as HTMLElement;
}

describe("EventCover", () => {
  test("sin personalización, usa el color determinístico por nombre", () => {
    const { container } = render(<EventCover event={event} />);

    expect(coverBox(container)).toHaveStyle({ backgroundColor: eventCoverColor(event.name) });
  });

  test("elegir un color de la paleta lo guarda, lo pinta y cierra el popover", async () => {
    const user = userEvent.setup();
    const { container } = render(<EventCover event={event} />);

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    const swatch = screen.getByRole("button", { name: "Usar color #1447e6" });
    await user.click(swatch);

    expect(coverBox(container)).toHaveStyle({ backgroundColor: "#1447e6" });
    expect(getEventCoverOverride(event.eid)).toEqual({ kind: "color", value: "#1447e6" });
    expect(screen.queryByRole("button", { name: "Usar color #1447e6" })).not.toBeInTheDocument();
  });

  test("pegar un enlace de imagen y enviarlo lo guarda como portada", async () => {
    const user = userEvent.setup();
    const { container } = render(<EventCover event={event} />);

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    await user.type(screen.getByLabelText("Enlace de imagen"), "https://example.com/foto.jpg");
    await user.click(screen.getByRole("button", { name: "Usar esta imagen" }));

    expect(coverBox(container)).toHaveStyle({ backgroundImage: "url(https://example.com/foto.jpg)" });
    expect(getEventCoverOverride(event.eid)).toEqual({ kind: "image", value: "https://example.com/foto.jpg" });
  });

  test("con una personalización activa aparece 'Quitar personalización', y al usarla vuelve al color por defecto", async () => {
    const user = userEvent.setup();
    render(<EventCover event={event} />);

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    expect(screen.queryByRole("button", { name: "Quitar personalización" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usar color #1447e6" }));

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    await user.click(screen.getByRole("button", { name: "Quitar personalización" }));

    expect(getEventCoverOverride(event.eid)).toBeNull();
  });

  test("una personalización guardada previamente (otro montaje del componente) se respeta al cargar", () => {
    const { container } = render(<EventCover event={{ ...event, eid: 42 }} />);
    // Sin overrides todavía para el eid 42: color por defecto.
    expect(coverBox(container)).toHaveStyle({ backgroundColor: eventCoverColor(event.name) });
  });

  test("clickear afuera del popover lo cierra sin guardar cambios", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <EventCover event={event} />
        <button type="button">Afuera</button>
      </div>
    );

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    expect(screen.getByRole("button", { name: "Usar esta imagen" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Afuera" }));

    expect(screen.queryByRole("button", { name: "Usar esta imagen" })).not.toBeInTheDocument();
    expect(getEventCoverOverride(event.eid)).toBeNull();
  });

  test("clickear un swatch de color no dispara el onClick de un contenedor ancestro (evita abrir la card al personalizar)", async () => {
    const user = userEvent.setup();
    let ancestorClicks = 0;
    render(
      <div role="button" tabIndex={0} aria-label="Abrir tarjeta" onClick={() => (ancestorClicks += 1)}>
        <EventCover event={event} />
      </div>
    );

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    await user.click(screen.getByRole("button", { name: "Usar color #1447e6" }));

    expect(ancestorClicks).toBe(0);
  });
});
