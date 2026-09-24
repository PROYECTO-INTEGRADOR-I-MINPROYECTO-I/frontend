import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EventFormModal } from "./event-form-modal";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// GET /tipos-evento/ no existe en el backend real (404): el componente cae
// al respaldo de tipos predefinidos (EVENT_TYPE_FALLBACKS), que incluye "Boda".
function stubEventTypesNotFound() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("/tipos-evento/")) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    return Promise.reject(new Error(`fetch no manejado en el test: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function waitForTypesLoaded() {
  const select = await screen.findByLabelText("Tipo");
  await waitFor(() => expect(select).not.toBeDisabled());
  return select;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EventFormModal", () => {
  test("enviar vacío muestra los errores de los campos obligatorios", async () => {
    const user = userEvent.setup();
    stubEventTypesNotFound();
    render(<EventFormModal onClose={vi.fn()} />);
    await waitForTypesLoaded();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Escribe el nombre del evento.")).toBeInTheDocument();
    expect(screen.getByText("Elige un tipo de evento.")).toBeInTheDocument();
    expect(screen.getByText("Indica la fecha del evento.")).toBeInTheDocument();
    expect(screen.getByText("Indica la hora del evento.")).toBeInTheDocument();
  });

  test("envía el payload correcto al crear", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/tipos-evento/")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      if (href.includes("/eventos/")) {
        return Promise.resolve(
          jsonResponse(
            {
              eid: 1,
              user: 1,
              name: "Boda Luisa & Carlos",
              description: "Ceremonia y recepción.",
              due_date: new Date("2026-10-15T14:30").toISOString(),
              status: "pending",
              progress_percentage: 0,
              created_at: new Date().toISOString(),
            },
            201
          )
        );
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<EventFormModal onClose={vi.fn()} onCreated={onCreated} />);
    const typeSelect = await waitForTypesLoaded();

    await user.type(screen.getByLabelText("Nombre"), "Boda Luisa & Carlos");
    await user.selectOptions(typeSelect, "Boda");
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "14:30" } });
    await user.type(screen.getByLabelText("Lugar"), "Jardines El Retiro");
    await user.type(screen.getByLabelText("Cliente / Contacto"), "Luisa Gómez");
    await user.type(screen.getByLabelText("Descripción"), "Ceremonia y recepción.");

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    const postCall = fetchMock.mock.calls.find(
      ([url, options]) => String(url).includes("/eventos/") && options?.method === "POST"
    );
    expect(postCall).toBeDefined();
    const [, options] = postCall!;
    const sentBody = JSON.parse(options.body as string);
    expect(sentBody).toMatchObject({
      name: "Boda Luisa & Carlos",
      description: "Ceremonia y recepción.",
      due_date: new Date("2026-10-15T14:30").toISOString(),
      place: "Jardines El Retiro",
      client_contact: "Luisa Gómez",
    });
    // El tipo elegido es un respaldo "default-*": no se envía como event_type real.
    expect(sentBody).not.toHaveProperty("event_type");
  });
});
