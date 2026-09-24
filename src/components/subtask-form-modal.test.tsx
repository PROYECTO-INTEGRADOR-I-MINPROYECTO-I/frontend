import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SubtaskFormModal } from "./subtask-form-modal";
import type { Subtask } from "../lib/types";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// GET /categorias/ no existe en el backend real (404): el componente cae al
// respaldo de categorías predefinidas (CATEGORY_FALLBACKS), así que basta
// con simular ese 404 para que "Catering" quede disponible en el select.
function stubCategoriesNotFound() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("/categorias/")) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    return Promise.reject(new Error(`fetch no manejado en el test: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function waitForCategoriesLoaded() {
  const select = await screen.findByLabelText("Categoría");
  await waitFor(() => expect(select).not.toBeDisabled());
  return select;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SubtaskFormModal", () => {
  test("no existe ningún control de Prioridad", async () => {
    stubCategoriesNotFound();
    render(<SubtaskFormModal eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} />);
    await waitForCategoriesLoaded();

    expect(screen.queryByLabelText(/prioridad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prioridad/i)).not.toBeInTheDocument();
  });

  test("el texto 'Horas estimadas' no es un <label htmlFor> roto (el grupo no es un control nativo)", async () => {
    stubCategoriesNotFound();
    render(<SubtaskFormModal eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} />);
    await waitForCategoriesLoaded();

    const hoursText = screen.getByText("Horas estimadas");
    expect(hoursText.tagName).not.toBe("LABEL");
    expect(hoursText).toHaveAttribute("id", "subtask-hours-label");

    const group = screen.getByRole("group", { name: "Horas estimadas" });
    expect(group).toHaveAttribute("id", "subtask-hours");
    expect(group).toHaveAttribute("aria-required", "true");
  });

  test("enviar sin horas estimadas muestra un error", async () => {
    const user = userEvent.setup();
    stubCategoriesNotFound();
    render(<SubtaskFormModal eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} />);
    const categorySelect = await waitForCategoriesLoaded();

    await user.type(screen.getByLabelText("Nombre"), "Confirmar catering");
    await user.selectOptions(categorySelect, "Catering");
    fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-10-01" } });

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Indica las horas estimadas.")).toBeInTheDocument();
  });

  test("elegir un chip de duración envía el estimated_hours correcto", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/categorias/")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      if (href.includes("/eventos/1/subtareas/")) {
        return Promise.resolve(
          jsonResponse(
            {
              subtask_id: 11,
              eid: 1,
              title: "Confirmar catering",
              description: "",
              category: "Catering",
              estimated_hours: "0.08",
              scheduled_date: "2026-10-01",
              status: "pending",
            },
            201
          )
        );
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SubtaskFormModal eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} onCreated={onCreated} />);
    const categorySelect = await waitForCategoriesLoaded();

    await user.type(screen.getByLabelText("Nombre"), "Confirmar catering");
    await user.selectOptions(categorySelect, "Catering");
    fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-10-01" } });
    await user.click(screen.getByRole("button", { name: "5 min" }));

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    const postCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/eventos/1/subtareas/"));
    expect(postCall).toBeDefined();
    const [, options] = postCall!;
    const sentBody = JSON.parse(options.body as string);
    expect(sentBody.estimated_hours).toBe("0.08");
  });

  test("crear envía el payload correcto, con priority fijo agregado por la capa de API", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/categorias/")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      if (href.includes("/eventos/1/subtareas/")) {
        return Promise.resolve(
          jsonResponse(
            {
              subtask_id: 10,
              eid: 1,
              title: "Confirmar catering",
              description: "",
              category: "Catering",
              estimated_hours: "2",
              scheduled_date: "2026-10-01",
              status: "pending",
            },
            201
          )
        );
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SubtaskFormModal eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} onCreated={onCreated} />);
    const categorySelect = await waitForCategoriesLoaded();

    await user.type(screen.getByLabelText("Nombre"), "Confirmar catering");
    await user.selectOptions(categorySelect, "Catering");
    fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-10-01" } });
    await user.click(screen.getByRole("button", { name: "2 h" }));

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    const postCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/eventos/1/subtareas/"));
    expect(postCall).toBeDefined();
    const [, options] = postCall!;
    const sentBody = JSON.parse(options.body as string);
    expect(sentBody).toMatchObject({
      title: "Confirmar catering",
      category: "Catering",
      estimated_hours: "2",
      scheduled_date: "2026-10-01",
      status: "pending",
      priority: "medium",
    });
  });

  test("editar envía solo los campos modificados", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const initialValues: Subtask = {
      subtask_id: 5,
      eid: 1,
      title: "Reservar salón",
      description: "Firmar el contrato.",
      category: "Lugar",
      estimated_hours: "1",
      scheduled_date: "2026-10-05",
      status: "pending",
    };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/categorias/")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      if (href.includes("/subtareas/5/")) {
        return Promise.resolve(jsonResponse({ ...initialValues, title: "Reservar salón principal" }, 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubtaskFormModal
        eventId={1}
        eventName="Boda Luisa & Carlos"
        initialValues={initialValues}
        onClose={vi.fn()}
        onUpdated={onUpdated}
      />
    );
    await waitForCategoriesLoaded();

    const titleInput = screen.getByLabelText("Nombre");
    await user.clear(titleInput);
    await user.type(titleInput, "Reservar salón principal");

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());

    const patchCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/subtareas/5/"));
    expect(patchCall).toBeDefined();
    const [, options] = patchCall!;
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({ title: "Reservar salón principal" });
  });

  test("un 400 del servidor pinta el error en el input correspondiente", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/categorias/")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      if (href.includes("/eventos/1/subtareas/")) {
        return Promise.resolve(
          jsonResponse({ title: ["Escribe el nombre de la gestión."] }, 400)
        );
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SubtaskFormModal eventId={1} eventName="Boda Luisa & Carlos" onClose={vi.fn()} />);
    const categorySelect = await waitForCategoriesLoaded();

    await user.type(screen.getByLabelText("Nombre"), "x");
    await user.selectOptions(categorySelect, "Catering");
    fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-10-01" } });
    await user.click(screen.getByRole("button", { name: "2 h" }));

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const titleInput = await screen.findByLabelText("Nombre");
    await waitFor(() => expect(titleInput).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("Escribe el nombre de la gestión.")).toBeInTheDocument();
  });
});
