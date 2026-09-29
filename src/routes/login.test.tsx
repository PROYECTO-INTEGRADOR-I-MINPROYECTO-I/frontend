import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LoginPage } from "./login";
import { AuthProvider } from "../lib/auth";
import { DEMO_CREDENTIALS } from "../lib/demo-auth";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// custom_exception_handler (backend/event/exceptions.py): todo error pasa
// por { success: false, error: { type, details } }, donde `details` es el
// cuerpo normal de DRF.
function backendError(type: string, details: unknown, status: number): Response {
  return jsonResponse({ success: false, error: { type, details } }, status);
}

// AuthProvider hace GET /auth/me/ al montar; se responde 401 (anónimo) salvo
// que un test necesite lo contrario.
function stubAuth(loginHandler?: (body: Record<string, unknown>) => Response) {
  const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const href = String(url);
    if (href.includes("/auth/me/")) {
      return Promise.resolve(new Response(null, { status: 401 }));
    }
    if (href.includes("/auth/login/")) {
      const body = JSON.parse(String(options?.body ?? "{}"));
      return Promise.resolve((loginHandler ?? (() => backendError("InvalidCredentials", { detail: "Credenciales inválidas" }, 401)))(body));
    }
    return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Página de inicio</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginPage", () => {
  test("renderiza el encabezado, los campos y el botón de envío", () => {
    stubAuth();
    renderLoginPage();

    expect(screen.getByText("¡Bienvenido!")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  test("los campos tienen su etiqueta asociada (htmlFor/id)", () => {
    stubAuth();
    renderLoginPage();

    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("id", "login-email");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("id", "login-password");
  });

  test("el recuadro de modo demo muestra las credenciales visibles", () => {
    stubAuth();
    renderLoginPage();

    expect(screen.getByText("Modo demo")).toBeInTheDocument();
    expect(screen.getByText(DEMO_CREDENTIALS.email)).toBeInTheDocument();
    expect(screen.getByText(DEMO_CREDENTIALS.password)).toBeInTheDocument();
  });

  test("'Usar cuenta demo' rellena los campos con las credenciales demo", async () => {
    stubAuth();
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole("button", { name: "Usar cuenta demo" }));

    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(DEMO_CREDENTIALS.email);
    expect(screen.getByLabelText("Contraseña")).toHaveValue(DEMO_CREDENTIALS.password);
  });

  test("un login exitoso hace POST /auth/login/ y navega a la página de inicio", async () => {
    const fetchMock = stubAuth((body) => {
      expect(body).toEqual({ email: DEMO_CREDENTIALS.email, password: DEMO_CREDENTIALS.password });
      return jsonResponse({ user_id: 1, name: "Demo", email: DEMO_CREDENTIALS.email, max_daily_hours: "6.00" }, 200);
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole("button", { name: "Usar cuenta demo" }));
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText("Página de inicio")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/login/"), expect.objectContaining({ method: "POST" }));
  });

  test("credenciales inválidas (401 real del backend) muestran su mensaje y no navegan", async () => {
    stubAuth();
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Correo electrónico"), "usuaria@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "secreta123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales inválidas");
    expect(screen.queryByText("Página de inicio")).not.toBeInTheDocument();
  });
});
