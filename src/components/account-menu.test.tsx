import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AccountMenu } from "./account-menu";
import { AuthProvider } from "../lib/auth";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const meUser = { user_id: 1, name: "Ana López", email: "ana@planificapp.com", max_daily_hours: "6.00" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<AccountMenu />} />
          <Route path="/login" element={<p>Página de login</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("AccountMenu", () => {
  test("muestra las iniciales del usuario real, no un valor fijo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: meUser, access: "access-1" })));
    renderMenu();

    expect(await screen.findByRole("button", { name: "Cuenta de Ana López" })).toHaveTextContent("AL");
  });

  test("clickear el botón abre el menú con 'Cerrar sesión'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: meUser, access: "access-1" })));
    const user = userEvent.setup();
    renderMenu();

    const trigger = await screen.findByRole("button", { name: "Cuenta de Ana López" });
    expect(screen.queryByRole("menuitem", { name: /cerrar sesión/i })).not.toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  test("el menú muestra el nombre del usuario, no solo las iniciales del avatar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: meUser, access: "access-1" })));
    const user = userEvent.setup();
    renderMenu();

    const trigger = await screen.findByRole("button", { name: "Cuenta de Ana López" });
    expect(screen.queryByText("Ana López")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByText("Ana López")).toBeInTheDocument();
  });

  test("'Cerrar sesión' hace POST /auth/logout/ y redirige a /login", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const href = String(url);
      if (href.includes("/auth/refresh/")) return Promise.resolve(jsonResponse({ user: meUser, access: "access-1" }));
      if (href.includes("/auth/logout/")) return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.reject(new Error(`fetch no manejado en el test: ${href}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderMenu();

    const trigger = await screen.findByRole("button", { name: "Cuenta de Ana López" });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /cerrar sesión/i }));

    expect(await screen.findByText("Página de login")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/logout/"), expect.objectContaining({ method: "POST" }));
  });

  test("clickear afuera cierra el menú sin cerrar sesión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: meUser, access: "access-1" })));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <div>
            <AccountMenu />
            <button type="button">Afuera</button>
          </div>
        </AuthProvider>
      </MemoryRouter>
    );

    const trigger = await screen.findByRole("button", { name: "Cuenta de Ana López" });
    await user.click(trigger);
    expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Afuera" }));

    await waitFor(() => expect(screen.queryByRole("menuitem", { name: /cerrar sesión/i })).not.toBeInTheDocument());
  });
});
