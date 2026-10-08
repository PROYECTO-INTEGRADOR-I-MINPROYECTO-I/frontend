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
});
