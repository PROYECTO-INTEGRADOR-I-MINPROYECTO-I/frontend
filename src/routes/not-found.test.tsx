import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NotFoundPage } from "./not-found";
import { AuthProvider } from "../lib/auth";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const meUser = { user_id: 1, name: "Demo", email: "demo@planificapp.com", max_daily_hours: "6.00" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubSession(active: boolean) {
  const response = active ? jsonResponse({ user: meUser, access: "access-1" }) : new Response(null, { status: 401 });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>Página de login</p>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("NotFoundPage", () => {
  test("sin sesión, ofrece iniciar sesión y crear cuenta", async () => {
    stubSession(false);
    renderAt("/no-existe");

    expect(await screen.findByRole("heading", { name: "Página no encontrada" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute("href", "/register");
  });

  test("con sesión, ofrece ir a Hoy y ver eventos", async () => {
    stubSession(true);
    renderAt("/no-existe");

    expect(await screen.findByRole("link", { name: "Ir a Hoy" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Ver mis eventos" })).toHaveAttribute("href", "/?vista=eventos");
  });

  test("muestra la ruta solicitada", async () => {
    stubSession(false);
    renderAt("/ruta/rara");

    expect(await screen.findByText("/ruta/rara")).toBeInTheDocument();
  });

  test("mientras carga la sesión, muestra el placeholder", async () => {
    let release: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((resolve) => (release = resolve))));
    renderAt("/no-existe");

    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    release(new Response(null, { status: 401 }));
    await screen.findByRole("heading", { name: "Página no encontrada" });
  });

  test("una ruta conocida no cae en la página no encontrada", async () => {
    stubSession(false);
    renderAt("/login");

    expect(await screen.findByText("Página de login")).toBeInTheDocument();
    expect(screen.queryByText("Página no encontrada")).not.toBeInTheDocument();
  });
});
