import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RegisterPage } from "./register";
import { AuthProvider } from "../lib/auth";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// custom_exception_handler (backend/event/exceptions.py): todo error pasa
// por { success: false, error: { type, details } }, donde `details` es el
// cuerpo normal de DRF ({ campo: ["mensaje"] } o { detail: "..." }).
function backendError(type: string, details: unknown, status: number): Response {
  return jsonResponse({ success: false, error: { type, details } }, status);
}

function stubAuth(registerHandler?: (body: Record<string, unknown>) => Response) {
  const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const href = String(url);
    if (href.includes("/auth/me/")) {
      return Promise.resolve(new Response(null, { status: 401 }));
    }
    if (href.includes("/auth/register/")) {
      const body = JSON.parse(String(options?.body ?? "{}"));
      return Promise.resolve(
        (registerHandler ?? (() => jsonResponse({ user_id: 1, name: body.name, email: body.email, max_daily_hours: "6.00" }, 201)))(
          body
        )
      );
    }
    return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<p>Página de inicio</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RegisterPage", () => {
  test("renderiza el encabezado, los campos y el botón de envío", () => {
    stubAuth();
    renderRegisterPage();

    expect(screen.getByText("Crea tu cuenta")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();
  });

  test("un registro exitoso hace POST /auth/register/ y navega a la página de inicio ya logueado", async () => {
    const fetchMock = stubAuth((body) => {
      expect(body).toEqual({ name: "Ana Pérez", email: "ana@example.com", password: "clave12345" });
      return jsonResponse({ user_id: 5, name: "Ana Pérez", email: "ana@example.com", max_daily_hours: "6.00" }, 201);
    });
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Nombre"), "Ana Pérez");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "clave12345");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Página de inicio")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/register/"), expect.objectContaining({ method: "POST" }));
  });

  test("un correo ya registrado pinta el error específicamente bajo el campo de correo", async () => {
    stubAuth(() => backendError("ValidationError", { email: ["No se pudo completar el registro con esos datos."] }, 400));
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Nombre"), "Ana Pérez");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "clave12345");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("No se pudo completar el registro con esos datos.")).toBeInTheDocument();
    expect(screen.queryByText("Página de inicio")).not.toBeInTheDocument();
  });

  test("una contraseña débil pinta el error bajo el campo de contraseña", async () => {
    stubAuth(() => backendError("ValidationError", { password: ["La contraseña debe tener al menos 8 caracteres."] }, 400));
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Nombre"), "Ana Pérez");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "clave1234");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("La contraseña debe tener al menos 8 caracteres.")).toBeInTheDocument();
  });
});
