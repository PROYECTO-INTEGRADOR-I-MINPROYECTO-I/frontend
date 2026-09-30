import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";
import { apiFetch } from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const meUser = { user_id: 1, name: "Demo", email: "demo@planificapp.com", max_daily_hours: "6.00" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <p>Cargando…</p>;
  return <p>{user ? `Sesión: ${user.email}` : "Anónimo"}</p>;
}

describe("AuthProvider", () => {
  test("al montar consulta GET /auth/me/ y expone el usuario si hay sesión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(meUser)));

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(await screen.findByText("Sesión: demo@planificapp.com")).toBeInTheDocument();
  });

  test("si /auth/me/ da 401 (anónimo), no lo trata como error fatal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Anónimo")).toBeInTheDocument();
  });

  test("un 401 de cualquier otro endpoint limpia el usuario y redirige a /login", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/auth/me/")) return Promise.resolve(jsonResponse(meUser));
      if (href.includes("/eventos/")) return Promise.resolve(new Response(null, { status: 401 }));
      return Promise.reject(new Error(`fetch no manejado: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    function TriggerUnauthorized() {
      const { user } = useAuth();
      return (
        <button type="button" onClick={() => apiFetch("/eventos/").catch(() => {})}>
          {user ? `Sesión: ${user.email}` : "Anónimo"}
        </button>
      );
    }

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<TriggerUnauthorized />} />
            <Route path="/login" element={<p>Página de login</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    const button = await screen.findByText("Sesión: demo@planificapp.com");
    button.click();

    expect(await screen.findByText("Página de login")).toBeInTheDocument();
  });

  test("register hace POST /auth/register/ y deja al usuario ya logueado", async () => {
    const newUser = { user_id: 2, name: "Nueva Organizadora", email: "nueva@planificapp.com", max_daily_hours: "6.00" };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/auth/me/")) return Promise.resolve(new Response(null, { status: 401 }));
      if (href.includes("/auth/register/")) return Promise.resolve(jsonResponse(newUser, 201));
      return Promise.reject(new Error(`fetch no manejado: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    function RegisterProbe() {
      const { user, register } = useAuth();
      return (
        <button
          type="button"
          onClick={() => register("Nueva Organizadora", "nueva@planificapp.com", "clave12345")}
        >
          {user ? `Sesión: ${user.email}` : "Anónimo"}
        </button>
      );
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterProbe />
        </AuthProvider>
      </MemoryRouter>
    );

    const button = await screen.findByText("Anónimo");
    button.click();

    expect(await screen.findByText("Sesión: nueva@planificapp.com")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/register/"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Nueva Organizadora", email: "nueva@planificapp.com", password: "clave12345" }),
      })
    );
  });

  test("logout hace POST /auth/logout/ y limpia el usuario", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/auth/me/")) return Promise.resolve(jsonResponse(meUser));
      if (href.includes("/auth/logout/")) return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.reject(new Error(`fetch no manejado: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    function LogoutProbe() {
      const { user, logout } = useAuth();
      return (
        <button type="button" onClick={() => logout()}>
          {user ? `Sesión: ${user.email}` : "Anónimo"}
        </button>
      );
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <LogoutProbe />
        </AuthProvider>
      </MemoryRouter>
    );

    const button = await screen.findByText("Sesión: demo@planificapp.com");
    button.click();

    await waitFor(() => expect(screen.getByText("Anónimo")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/logout/"), expect.objectContaining({ method: "POST" }));
  });
});
