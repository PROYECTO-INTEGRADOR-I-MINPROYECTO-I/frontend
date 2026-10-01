import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";
import { apiFetch, setAccessToken } from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const session = (user: typeof meUser) => ({ user, access: "access-1" });
const meUser = { user_id: 1, name: "Demo", email: "demo@planificapp.com", max_daily_hours: "6.00" };

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <p>Cargando…</p>;
  return <p>{user ? `Sesión: ${user.email}` : "Anónimo"}</p>;
}

describe("AuthProvider", () => {
  test("al montar hace POST /auth/refresh/ y expone el usuario si hay sesión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(session(meUser))));

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

  test("si /auth/refresh/ da 401 (anónimo), no lo trata como error fatal", async () => {
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
      if (href.includes("/auth/refresh/")) return Promise.resolve(jsonResponse(session(meUser)));
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
      if (href.includes("/auth/refresh/")) return Promise.resolve(new Response(null, { status: 401 }));
      if (href.includes("/auth/register/")) return Promise.resolve(jsonResponse(session(newUser), 201));
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
      if (href.includes("/auth/refresh/")) return Promise.resolve(jsonResponse(session(meUser)));
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

  test("el bootstrap guarda el access en memoria y las peticiones siguientes lo envían como Bearer", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/auth/refresh/")) return Promise.resolve(jsonResponse(session(meUser)));
      if (href.includes("/eventos/")) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`fetch no manejado: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );
    await screen.findByText("Sesión: demo@planificapp.com");

    await apiFetch("/eventos/");

    const [, options] = fetchMock.mock.calls.find(([url]) => String(url).includes("/eventos/"))!;
    expect((options as RequestInit).headers).toMatchObject({ Authorization: "Bearer access-1" });
  });

  test("logout limpia el access token: la petición siguiente ya no manda Authorization", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/auth/refresh/")) return Promise.resolve(jsonResponse(session(meUser)));
      if (href.includes("/auth/logout/")) return Promise.resolve(new Response(null, { status: 204 }));
      if (href.includes("/eventos/")) return Promise.resolve(jsonResponse([]));
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
    await screen.findByText("Anónimo");

    await apiFetch("/eventos/");

    const [, options] = fetchMock.mock.calls.find(([url]) => String(url).includes("/eventos/"))!;
    expect((options as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  test("logout con un refresh en vuelo: al resolver, ni el token ni el usuario reviven", async () => {
    let releaseRefresh: (r: Response) => void = () => {};
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/auth/refresh/")) return new Promise<Response>((resolve) => (releaseRefresh = resolve));
      if (href.includes("/auth/logout/")) return Promise.resolve(new Response(null, { status: 204 }));
      if (href.includes("/eventos/")) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`fetch no manejado: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    function LogoutProbe() {
      const { user, loading, logout } = useAuth();
      return (
        <button type="button" onClick={() => logout()}>
          {loading ? "Cargando…" : user ? `Sesión: ${user.email}` : "Anónimo"}
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
    screen.getByText("Cargando…").click();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/logout/"), expect.anything())
    );

    releaseRefresh(jsonResponse(session(meUser)));

    expect(await screen.findByText("Anónimo")).toBeInTheDocument();
    await apiFetch("/eventos/");
    const [, options] = fetchMock.mock.calls.find(([url]) => String(url).includes("/eventos/"))!;
    expect((options as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  test("login con el bootstrap pendiente: el resultado obsoleto no pisa al usuario logueado", async () => {
    let releaseRefresh: (r: Response) => void = () => {};
    const other = { user_id: 9, name: "Vieja", email: "vieja@planificapp.com", max_daily_hours: "6.00" };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/auth/refresh/")) return new Promise<Response>((resolve) => (releaseRefresh = resolve));
      if (href.includes("/auth/login/")) return Promise.resolve(jsonResponse(session(meUser)));
      return Promise.reject(new Error(`fetch no manejado: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    function LoginProbe() {
      const { user, login } = useAuth();
      return (
        <button type="button" onClick={() => login("demo@planificapp.com", "demo1234")}>
          {user ? `Sesión: ${user.email}` : "Anónimo"}
        </button>
      );
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginProbe />
        </AuthProvider>
      </MemoryRouter>
    );
    screen.getByText("Anónimo").click();
    await screen.findByText("Sesión: demo@planificapp.com");

    releaseRefresh(jsonResponse({ user: other, access: "access-viejo" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.getByText("Sesión: demo@planificapp.com")).toBeInTheDocument();
  });
});
