import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EventWizard } from "./event-wizard";
import type { Event } from "../lib/types";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const createdEvent: Event = {
  eid: 7,
  user: 1,
  name: "Lanzamiento de producto",
  description: "",
  due_date: "2026-12-01T18:00:00.000Z",
  status: "pending",
  progress_percentage: 0,
  created_at: "2026-09-20T00:00:00.000Z",
};

// GET /tipos-evento/ y /categorias/ no existen en el backend real hoy (404):
// ambos formularios caen a sus respaldos predefinidos ("Boda", "Lugar"...).
function stubWizardFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const href = String(url);
    const method = options?.method ?? "GET";
    if (href.includes("/tipos-evento/") || href.includes("/categorias/")) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    if (method === "POST" && href.includes("/eventos/") && !href.includes("subtareas")) {
      return Promise.resolve(jsonResponse(createdEvent, 201));
    }
    if (method === "POST" && href.includes(`/eventos/${createdEvent.eid}/subtareas/`)) {
      const body = JSON.parse(String(options?.body ?? "{}"));
      return Promise.resolve(
        jsonResponse({ subtask_id: Math.floor(Math.random() * 100000), eid: createdEvent.eid, ...body }, 201)
      );
    }
    return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function waitForTypesLoaded() {
  const select = await screen.findByLabelText("Tipo");
  await waitFor(() => expect(select).not.toBeDisabled());
  return select;
}

async function startWizard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Comenzar" }));
}

async function fillBasicStage(user: ReturnType<typeof userEvent.setup>, name: string) {
  const typeSelect = await waitForTypesLoaded();
  await user.type(screen.getByLabelText("Nombre"), name);
  await user.selectOptions(typeSelect, "Boda");
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
}

async function fillFechaStage(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(await screen.findByLabelText("Fecha"), { target: { value: "2026-12-01" } });
  fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "18:00" } });
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EventWizard", () => {
  test("empieza en la stage de intro; 'Comenzar' avanza a la primera stage de campos", async () => {
    stubWizardFetch();
    render(<EventWizard onClose={vi.fn()} onEventCreated={vi.fn()} onSubtaskCreated={vi.fn()} />);

    expect(screen.getByText("¡Vamos a crear un nuevo evento!")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await startWizard(user);

    expect(await screen.findByText("¿Qué evento es?")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });

  test("'Siguiente' sin completar los campos obligatorios no avanza y pinta los errores", async () => {
    stubWizardFetch();
    const user = userEvent.setup();
    render(<EventWizard onClose={vi.fn()} onEventCreated={vi.fn()} onSubtaskCreated={vi.fn()} />);
    await startWizard(user);
    await waitForTypesLoaded();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("Escribe el nombre del evento.")).toBeInTheDocument();
    expect(screen.getByText("Elige un tipo de evento.")).toBeInTheDocument();
    // Sigue en la misma stage: el campo Nombre todavía está en pantalla.
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });

  test("'Atrás' vuelve a la stage anterior sin perder lo ya escrito", async () => {
    stubWizardFetch();
    const user = userEvent.setup();
    render(<EventWizard onClose={vi.fn()} onEventCreated={vi.fn()} onSubtaskCreated={vi.fn()} />);
    await startWizard(user);
    await fillBasicStage(user, "Lanzamiento de producto");

    expect(await screen.findByText("¿Cuándo y dónde?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atrás" }));

    expect(await screen.findByText("¿Qué evento es?")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Lanzamiento de producto");
  });

  test("no se puede saltar adelante haciendo click en un círculo no alcanzado", async () => {
    stubWizardFetch();
    const user = userEvent.setup();
    render(<EventWizard onClose={vi.fn()} onEventCreated={vi.fn()} onSubtaskCreated={vi.fn()} />);
    await startWizard(user);
    await waitForTypesLoaded();

    // Paso 3 ("¿Para quién?") todavía no se alcanzó: su círculo está deshabilitado.
    expect(screen.getByRole("tab", { name: "Paso 3" })).toBeDisabled();
  });

  test("al completar las 3 stages de campos crea el evento y pasa a la stage de plan inicial", async () => {
    const fetchMock = stubWizardFetch();
    const onEventCreated = vi.fn();
    const user = userEvent.setup();
    render(<EventWizard onClose={vi.fn()} onEventCreated={onEventCreated} onSubtaskCreated={vi.fn()} />);

    await startWizard(user);
    await fillBasicStage(user, "Lanzamiento de producto");
    await fillFechaStage(user);

    expect(await screen.findByText("¿Para quién?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear evento" }));

    expect(await screen.findByText("Plan inicial de gestiones")).toBeInTheDocument();
    expect(onEventCreated).toHaveBeenCalledWith(createdEvent);
    const postCall = fetchMock.mock.calls.find(
      ([url, options]) => String(url).includes("/eventos/") && options?.method === "POST"
    );
    expect(postCall).toBeTruthy();
    const sentBody = JSON.parse(String(postCall?.[1]?.body));
    expect(sentBody).toMatchObject({ name: "Lanzamiento de producto" });
  });

  test("una vez creado el evento, ya no se puede volver a editar sus stages de campos", async () => {
    stubWizardFetch();
    const user = userEvent.setup();
    render(<EventWizard onClose={vi.fn()} onEventCreated={vi.fn()} onSubtaskCreated={vi.fn()} />);

    await startWizard(user);
    await fillBasicStage(user, "Lanzamiento de producto");
    await fillFechaStage(user);
    await user.click(screen.getByRole("button", { name: "Crear evento" }));
    await screen.findByText("Plan inicial de gestiones");

    expect(screen.getByRole("tab", { name: "Paso 2" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Paso 3" })).toBeDisabled();
  });

  test("la stage de plan inicial agrega gestiones ordenadas por fecha y desempate por horas", async () => {
    stubWizardFetch();
    const onSubtaskCreated = vi.fn();
    const user = userEvent.setup();
    render(<EventWizard onClose={vi.fn()} onEventCreated={vi.fn()} onSubtaskCreated={onSubtaskCreated} />);

    await startWizard(user);
    await fillBasicStage(user, "Lanzamiento de producto");
    await fillFechaStage(user);
    await user.click(screen.getByRole("button", { name: "Crear evento" }));
    await screen.findByText("Plan inicial de gestiones");

    // Primera gestión: más tarde en el calendario.
    await user.click(screen.getByRole("button", { name: "Agregar gestión" }));
    await user.type(await screen.findByLabelText("Nombre"), "Confirmar catering");
    const categorySelect = screen.getByLabelText("Categoría");
    await waitFor(() => expect(categorySelect).not.toBeDisabled());
    await user.selectOptions(categorySelect, "Lugar");
    fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-11-20" } });
    await user.click(screen.getByRole("button", { name: "2 h" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Confirmar catering")).toBeInTheDocument();
    expect(onSubtaskCreated).toHaveBeenCalledTimes(1);

    // Segunda gestión: antes en el calendario — debe listarse primero.
    await user.click(screen.getByRole("button", { name: "Agregar gestión" }));
    await user.type(await screen.findByLabelText("Nombre"), "Reservar salón");
    const secondCategorySelect = screen.getByLabelText("Categoría");
    await waitFor(() => expect(secondCategorySelect).not.toBeDisabled());
    await user.selectOptions(secondCategorySelect, "Lugar");
    fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-11-10" } });
    await user.click(screen.getByRole("button", { name: "1 h" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await screen.findByText("Reservar salón");
    const rowNames = screen.getAllByRole("row").map((row) => row.textContent ?? "");
    const salonIndex = rowNames.findIndex((text) => text.includes("Reservar salón"));
    const cateringIndex = rowNames.findIndex((text) => text.includes("Confirmar catering"));
    expect(salonIndex).toBeGreaterThan(-1);
    expect(salonIndex).toBeLessThan(cateringIndex);
  });

  test("'Finalizar' en la stage de plan inicial cierra el wizard", async () => {
    stubWizardFetch();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EventWizard onClose={onClose} onEventCreated={vi.fn()} onSubtaskCreated={vi.fn()} />);

    await startWizard(user);
    await fillBasicStage(user, "Lanzamiento de producto");
    await fillFechaStage(user);
    await user.click(screen.getByRole("button", { name: "Crear evento" }));
    await screen.findByText("Plan inicial de gestiones");

    await user.click(screen.getByRole("button", { name: "Finalizar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
