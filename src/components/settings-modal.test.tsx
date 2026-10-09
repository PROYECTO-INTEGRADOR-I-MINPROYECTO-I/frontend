import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SettingsModal } from "./settings-modal";
import { AuthProvider } from "../lib/auth";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const meUser = { user_id: 1, name: "Ana López", email: "ana@planificapp.com", max_daily_hours: "6.00" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSettings(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SettingsModal onClose={vi.fn()} />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("SettingsModal", () => {
  test("precarga el límite diario actual del usuario, por defecto 6 horas", async () => {
    renderSettings(vi.fn().mockResolvedValue(jsonResponse({ user: meUser, access: "access-1" }, 200)));

    expect(await screen.findByLabelText("Límite diario de horas de gestión")).toHaveValue(6);
    expect(screen.getByText("Entre 1 y 16 horas al día. Por defecto, 6 horas.")).toBeInTheDocument();
  });

  test("guardar un valor fuera de rango (1-16) no envía nada y muestra el mensaje de ayuda del rango", async () => {
    const user = userEvent.setup();
    renderSettings(vi.fn().mockResolvedValue(jsonResponse({ user: meUser, access: "access-1" }, 200)));

    const input = await screen.findByLabelText("Límite diario de horas de gestión");
    await user.clear(input);
    await user.type(input, "20");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("El límite debe estar entre 1 y 16 horas.")).toBeInTheDocument();
  });

  test("guarda un valor válido con PUT /user/settings/ y confirma el cambio", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      if (href.includes("/auth/refresh/")) {
        return Promise.resolve(jsonResponse({ user: meUser, access: "access-1" }, 200));
      }
      if (method === "PUT" && href.includes("/user/settings/")) {
        const body = JSON.parse(String(options?.body ?? "{}"));
        return Promise.resolve(jsonResponse({ max_daily_hours: body.max_daily_hours }, 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    renderSettings(fetchMock);

    const input = await screen.findByLabelText("Límite diario de horas de gestión");
    await user.clear(input);
    await user.type(input, "4.5");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Límite diario actualizado.")).toBeInTheDocument();
    const putCall = fetchMock.mock.calls.find(
      ([url, options]) => String(url).includes("/user/settings/") && options?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({ max_daily_hours: "4.5" });
  });

  test("un error del servidor muestra el banner con Reintentar", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      if (href.includes("/auth/refresh/")) {
        return Promise.resolve(jsonResponse({ user: meUser, access: "access-1" }, 200));
      }
      if (method === "PUT" && href.includes("/user/settings/")) {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    renderSettings(fetchMock);

    await screen.findByLabelText("Límite diario de horas de gestión");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Ocurrió un error en el servidor");
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled());
  });

  test("un 400 por días sobrecargados se muestra bajo el campo, sin banner ni Reintentar", async () => {
    const user = userEvent.setup();
    const message =
      "No puedes bajar el límite a 4h: hay días con más horas planificadas (15/10/2026: 7h). Reprograma o reduce esas gestiones primero.";
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      if (href.includes("/auth/refresh/")) {
        return Promise.resolve(jsonResponse({ user: meUser, access: "access-1" }, 200));
      }
      if (method === "PUT" && href.includes("/user/settings/")) {
        return Promise.resolve(
          jsonResponse(
            { success: false, error: { type: "ValidationError", details: { max_daily_hours: [message] } } },
            400
          )
        );
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    renderSettings(fetchMock);

    const input = await screen.findByLabelText("Límite diario de horas de gestión");
    await user.clear(input);
    await user.type(input, "4");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const fieldError = await screen.findByText(message);
    expect(fieldError).toHaveAttribute("role", "alert");
    expect(fieldError).toHaveAttribute("id", "settings-max-hours-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Límite diario actualizado.")).not.toBeInTheDocument();
  });

  test("un 400 sin error en max_daily_hours sigue mostrando el banner con Reintentar", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      if (href.includes("/auth/refresh/")) {
        return Promise.resolve(jsonResponse({ user: meUser, access: "access-1" }, 200));
      }
      if (method === "PUT" && href.includes("/user/settings/")) {
        return Promise.resolve(
          jsonResponse(
            { success: false, error: { type: "ValidationError", details: { other_field: ["Campo inválido."] } } },
            400
          )
        );
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    renderSettings(fetchMock);

    await screen.findByLabelText("Límite diario de horas de gestión");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(document.getElementById("settings-max-hours-error")).toBeNull();
  });

  test("tras un error de campo, un segundo guardado exitoso lo limpia y confirma el cambio", async () => {
    const user = userEvent.setup();
    const message = "No puedes bajar el límite a 4h: hay días con más horas planificadas (15/10/2026: 7h).";
    let puts = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const href = String(url);
      const method = options?.method ?? "GET";
      if (href.includes("/auth/refresh/")) {
        return Promise.resolve(jsonResponse({ user: meUser, access: "access-1" }, 200));
      }
      if (method === "PUT" && href.includes("/user/settings/")) {
        puts += 1;
        if (puts === 1) {
          return Promise.resolve(
            jsonResponse(
              { success: false, error: { type: "ValidationError", details: { max_daily_hours: [message] } } },
              400
            )
          );
        }
        const body = JSON.parse(String(options?.body ?? "{}"));
        return Promise.resolve(jsonResponse({ max_daily_hours: body.max_daily_hours }, 200));
      }
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    renderSettings(fetchMock);

    const input = await screen.findByLabelText("Límite diario de horas de gestión");
    await user.clear(input);
    await user.type(input, "4");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText(message)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "8");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Límite diario actualizado.")).toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");
  });
});
