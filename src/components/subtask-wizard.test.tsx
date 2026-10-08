import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SubtaskWizard } from "./subtask-wizard";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// GET /categorias/ no existe en el backend real (404): cae al respaldo
// predefinido (incluye "Catering").
function stubCategoriesNotFound(extra?: (url: string, options?: RequestInit) => Response | Promise<Response> | null) {
  const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const href = String(url);
    if (href.includes("/categorias/")) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    const result = extra?.(href, options);
    if (result) return Promise.resolve(result);
    return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function waitForCategoriesLoaded() {
  const select = await screen.findByLabelText("Categoría");
  await waitFor(() => expect(select).not.toBeDisabled());
  return select;
}

async function startWizard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Comenzar" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SubtaskWizard", () => {
  test("la intro menciona el evento dueño, para diferenciarse del wizard de evento", async () => {
    stubCategoriesNotFound();
    render(<SubtaskWizard eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByText(/¡Vamos a crear una nueva gestión para «Boda Luisa & Carlos»!/)).toBeInTheDocument();
    // El chip del evento dueño vive en la cabecera del modal durante todo el wizard.
    expect(screen.getByText("Boda Luisa & Carlos", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
  });

  test("'Siguiente' sin completar los campos obligatorios no avanza y pinta los errores", async () => {
    stubCategoriesNotFound();
    const user = userEvent.setup();
    render(<SubtaskWizard eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} onCreated={vi.fn()} />);
    await startWizard(user);
    await waitForCategoriesLoaded();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("Escribe el nombre de la gestión.")).toBeInTheDocument();
    expect(screen.getByText("Elige una categoría.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });

  test("'Atrás' vuelve a la stage anterior sin perder lo ya escrito", async () => {
    stubCategoriesNotFound();
    const user = userEvent.setup();
    render(<SubtaskWizard eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} onCreated={vi.fn()} />);
    await startWizard(user);
    const categorySelect = await waitForCategoriesLoaded();
    await user.type(screen.getByLabelText("Nombre"), "Confirmar catering");
    await user.selectOptions(categorySelect, "Catering");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("¿Cuándo y cuánto esfuerzo?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atrás" }));

    expect(await screen.findByText("¿Qué gestión es?")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Confirmar catering");
  });

  test("avisa (sin bloquear) cuando la fecha objetivo es posterior a la del evento", async () => {
    stubCategoriesNotFound();
    const user = userEvent.setup();
    render(
      <SubtaskWizard
        eventId={1}
        eventName="Boda Luisa & Carlos"
        eventDueDate="2026-10-01T18:00:00.000Z"
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );
    await startWizard(user);
    const categorySelect = await waitForCategoriesLoaded();
    await user.type(screen.getByLabelText("Nombre"), "Confirmar catering");
    await user.selectOptions(categorySelect, "Catering");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.change(await screen.findByLabelText("Fecha objetivo"), { target: { value: "2026-10-15" } });

    expect(await screen.findByText("La fecha objetivo es posterior a la fecha del evento.")).toBeInTheDocument();
  });

  test("crea la gestión al completar las 3 stages y llama a onCreated", async () => {
    const createdSubtask = {
      subtask_id: 50,
      eid: 1,
      title: "Confirmar catering",
      description: "",
      category: "Catering",
      estimated_hours: "2.00",
      scheduled_date: "2026-10-20",
      status: "pending",
    };
    const fetchMock = stubCategoriesNotFound((href, options) => {
      if (href.includes("/eventos/1/subtareas/") && (options?.method ?? "GET") === "POST") {
        return jsonResponse(createdSubtask, 201);
      }
      return null;
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(<SubtaskWizard eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} onCreated={onCreated} />);

    await startWizard(user);
    const categorySelect = await waitForCategoriesLoaded();
    await user.type(screen.getByLabelText("Nombre"), "Confirmar catering");
    await user.selectOptions(categorySelect, "Catering");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.change(await screen.findByLabelText("Fecha objetivo"), { target: { value: "2026-10-20" } });
    await user.click(screen.getByRole("button", { name: "2 h" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("¿Algo más que agregar?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear gestión" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdSubtask, undefined));
    const postCall = fetchMock.mock.calls.find(
      ([url, options]) => String(url).includes("/eventos/1/subtareas/") && options?.method === "POST"
    );
    const sentBody = JSON.parse(String(postCall?.[1]?.body));
    expect(sentBody).toMatchObject({ title: "Confirmar catering", category: "Catering", estimated_hours: "2" });
  });

  test("crear una gestión que supera el límite diario abre el wizard de conflicto en vez de mandar el POST (C3)", async () => {
    const fetchMock = stubCategoriesNotFound((href, options) => {
      if (href.includes("/hoy/")) {
        return jsonResponse(
          {
            fecha: "2026-09-28",
            metrica: "gestiones",
            vencidas: [],
            para_hoy: { pendientes: [], completadas: [] },
            proximas: [
              { subtask_id: 9, eid: 2, title: "Otra gestión", description: "", category: "Lugar", estimated_hours: "5", scheduled_date: "2026-10-20", status: "pending" },
            ],
            progreso_dia: { completadas: 0, total: 0, horas_completadas: "0", horas_totales: "0" },
            filtros: { event_id: null, status: null },
          },
          200
        );
      }
      // Si esto se llega a invocar, el conflicto no se detectó a tiempo.
      if (href.includes("/eventos/1/subtareas/") && (options?.method ?? "GET") === "POST") {
        throw new Error("no debería llegar a crear con el conflicto sin resolver");
      }
      return null;
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <SubtaskWizard
        eventId={1}
        eventName="Boda Luisa & Carlos"
        maxDailyHours="6.00"
        onClose={vi.fn()}
        onCreated={onCreated}
      />
    );

    await startWizard(user);
    const categorySelect = await waitForCategoriesLoaded();
    await user.type(screen.getByLabelText("Nombre"), "Confirmar catering");
    await user.selectOptions(categorySelect, "Catering");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    // Límite 6h, el día ya tiene 5h (de otro evento); 2h más son 7h > 6h: conflicto.
    fireEvent.change(await screen.findByLabelText("Fecha objetivo"), { target: { value: "2026-10-20" } });
    await user.click(screen.getByRole("button", { name: "2 h" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Crear gestión" }));

    expect(await screen.findByText("¡Esta reprogramación supera tu límite diario!")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([url, opts]) => String(url).includes("/eventos/1/subtareas/") && opts?.method === "POST")
    ).toBe(false);

    // Resolver con "reducir horas" vuelve a la stage de fecha/horas con el valor ya aplicado.
    await user.click(screen.getByRole("button", { name: "Ver opciones de solución" }));
    await user.click(screen.getByRole("button", { name: "Opción 2: Reducir duración de la gestión a 1 horas" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.queryByText("¡Esta reprogramación supera tu límite diario!")).not.toBeInTheDocument();
    expect(await screen.findByText("¿Cuándo y cuánto esfuerzo?")).toBeInTheDocument();
  });

  test("fecha vencida muestra el popup no ignorable y no guarda hasta confirmar", async () => {
    const createdSubtask = {
      subtask_id: 51,
      eid: 1,
      title: "Llamar al proveedor",
      description: "",
      category: "Catering",
      estimated_hours: "1.00",
      scheduled_date: "2020-01-01",
      status: "pending",
    };
    const fetchMock = stubCategoriesNotFound((href, options) => {
      if (href.includes("/eventos/1/subtareas/") && (options?.method ?? "GET") === "POST") {
        return jsonResponse(createdSubtask, 201);
      }
      return null;
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(<SubtaskWizard eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} onCreated={onCreated} />);

    await startWizard(user);
    const categorySelect = await waitForCategoriesLoaded();
    await user.type(screen.getByLabelText("Nombre"), "Llamar al proveedor");
    await user.selectOptions(categorySelect, "Catering");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    // Fecha claramente en el pasado.
    fireEvent.change(await screen.findByLabelText("Fecha objetivo"), { target: { value: "2020-01-01" } });
    await user.click(screen.getByRole("button", { name: "1 h" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(await screen.findByRole("button", { name: "Crear gestión" }));

    expect(await screen.findByText("Esta gestión ya está vencida")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Crear de todos modos" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) => String(url).includes("/eventos/1/subtareas/") && options?.method === "POST"
      )
    ).toBe(true);
  });
});
