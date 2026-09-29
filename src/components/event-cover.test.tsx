import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EventCover } from "./event-cover";
import { eventCoverColor } from "../lib/event-display";
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function coverBox(container: HTMLElement): HTMLElement {
  return container.querySelector("[aria-hidden='true']") as HTMLElement;
}

describe("EventCover", () => {
  test("sin cover_kind/cover_value, usa el color determinístico por nombre", () => {
    const { container } = render(<EventCover event={event} onEventCoverUpdated={vi.fn()} />);

    expect(coverBox(container)).toHaveStyle({ backgroundColor: eventCoverColor(event.name) });
  });

  test("con cover_kind/cover_value ya guardados (ej. tras recargar), los pinta directamente", () => {
    const { container } = render(
      <EventCover event={{ ...event, cover_kind: "color", cover_value: "#1447e6" }} onEventCoverUpdated={vi.fn()} />
    );

    expect(coverBox(container)).toHaveStyle({ backgroundColor: "#1447e6" });
  });

  test("elegir un color de la paleta hace PATCH /eventos/<eid>/ y avisa al padre con el evento actualizado", async () => {
    const user = userEvent.setup();
    const updatedEvent = { ...event, cover_kind: "color" as const, cover_value: "#1447e6" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(updatedEvent));
    vi.stubGlobal("fetch", fetchMock);
    const onEventCoverUpdated = vi.fn();

    render(<EventCover event={event} onEventCoverUpdated={onEventCoverUpdated} />);

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    await user.click(screen.getByRole("button", { name: "Usar color #1447e6" }));

    await waitFor(() => expect(onEventCoverUpdated).toHaveBeenCalledWith(updatedEvent));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/eventos/1/"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ cover_kind: "color", cover_value: "#1447e6" }),
      })
    );
    // El popover se cierra tras guardar.
    expect(screen.queryByRole("button", { name: "Usar color #1447e6" })).not.toBeInTheDocument();
  });

  test("pegar un enlace de imagen y enviarlo hace PATCH con cover_kind image", async () => {
    const user = userEvent.setup();
    const updatedEvent = { ...event, cover_kind: "image" as const, cover_value: "https://example.com/foto.jpg" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(updatedEvent));
    vi.stubGlobal("fetch", fetchMock);
    const onEventCoverUpdated = vi.fn();

    render(<EventCover event={event} onEventCoverUpdated={onEventCoverUpdated} />);

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    await user.type(screen.getByLabelText("Enlace de imagen"), "https://example.com/foto.jpg");
    await user.click(screen.getByRole("button", { name: "Usar esta imagen" }));

    await waitFor(() => expect(onEventCoverUpdated).toHaveBeenCalledWith(updatedEvent));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/eventos/1/"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ cover_kind: "image", cover_value: "https://example.com/foto.jpg" }),
      })
    );
  });

  test("con una personalización activa aparece 'Quitar personalización', y al usarla manda ambos campos en null", async () => {
    const user = userEvent.setup();
    const cleared = { ...event, cover_kind: null, cover_value: null };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(cleared));
    vi.stubGlobal("fetch", fetchMock);
    const onEventCoverUpdated = vi.fn();

    render(
      <EventCover
        event={{ ...event, cover_kind: "color", cover_value: "#1447e6" }}
        onEventCoverUpdated={onEventCoverUpdated}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    await user.click(screen.getByRole("button", { name: "Quitar personalización" }));

    await waitFor(() => expect(onEventCoverUpdated).toHaveBeenCalledWith(cleared));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/eventos/1/"),
      expect.objectContaining({ body: JSON.stringify({ cover_kind: null, cover_value: null }) })
    );
  });

  test("sin personalización, no se muestra 'Quitar personalización'", async () => {
    const user = userEvent.setup();
    render(<EventCover event={event} onEventCoverUpdated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    expect(screen.queryByRole("button", { name: "Quitar personalización" })).not.toBeInTheDocument();
  });

  test("si el PATCH falla, muestra el mensaje de error y deja el popover abierto para reintentar", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    render(<EventCover event={event} onEventCoverUpdated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    await user.click(screen.getByRole("button", { name: "Usar color #1447e6" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/error en el servidor/i);
    // Sigue abierto: se puede reintentar sin volver a abrir el popover.
    expect(screen.getByRole("button", { name: "Usar color #1447e6" })).toBeInTheDocument();
  });

  test("clickear afuera del popover lo cierra sin guardar cambios", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <EventCover event={event} onEventCoverUpdated={vi.fn()} />
        <button type="button">Afuera</button>
      </div>
    );

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    expect(screen.getByRole("button", { name: "Usar esta imagen" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Afuera" }));

    expect(screen.queryByRole("button", { name: "Usar esta imagen" })).not.toBeInTheDocument();
  });

  test("clickear un swatch de color no dispara el onClick de un contenedor ancestro (evita abrir la card al personalizar)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...event, cover_kind: "color", cover_value: "#1447e6" })));
    let ancestorClicks = 0;

    render(
      <div role="button" tabIndex={0} aria-label="Abrir tarjeta" onClick={() => (ancestorClicks += 1)}>
        <EventCover event={event} onEventCoverUpdated={vi.fn()} />
      </div>
    );

    await user.click(screen.getByRole("button", { name: "Cambiar portada del evento" }));
    await user.click(screen.getByRole("button", { name: "Usar color #1447e6" }));

    expect(ancestorClicks).toBe(0);
  });
});
