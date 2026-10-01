import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProtectedRoute } from "./protected-route";
import { AuthProvider } from "../lib/auth";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const meUser = { user_id: 1, name: "Demo", email: "demo@planificapp.com", max_daily_hours: "6.00" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <p>Contenido privado</p>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<p>Página de login</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  test("mientras se resuelve /auth/refresh/, muestra un placeholder y no el contenido ni el login", async () => {
    // Promesa pendiente: loading se queda en true durante el test. Se resuelve
    // al final para no dejar el refresh single-flight colgado en los demás tests.
    let release: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((resolve) => (release = resolve))));

    renderProtected();

    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
    expect(screen.queryByText("Página de login")).not.toBeInTheDocument();

    release(new Response(null, { status: 401 }));
    await screen.findByText("Página de login");
  });

  test("sin sesión (401 en /auth/refresh/), redirige a /login sin mostrar el contenido", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    renderProtected();

    expect(await screen.findByText("Página de login")).toBeInTheDocument();
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
  });

  test("con sesión activa, muestra el contenido protegido", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: meUser, access: "access-1" })));

    renderProtected();

    expect(await screen.findByText("Contenido privado")).toBeInTheDocument();
    expect(screen.queryByText("Página de login")).not.toBeInTheDocument();
  });
});
