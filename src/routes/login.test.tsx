import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test } from "vitest";
import { LoginPage } from "./login";
import { DEMO_CREDENTIALS } from "../lib/demo-auth";

// Sin backend de login (ver src/lib/demo-auth.ts): solo la cuenta demo
// entra. Cualquier otra combinación muestra un error visible.

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Página de inicio</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  test("renderiza el encabezado, los campos y el botón de envío", () => {
    renderLoginPage();

    expect(screen.getByText("¡Bienvenido!")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  test("los campos tienen su etiqueta asociada (htmlFor/id)", () => {
    renderLoginPage();

    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("id", "login-email");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("id", "login-password");
  });

  test("el recuadro de modo demo muestra las credenciales visibles", () => {
    renderLoginPage();

    expect(screen.getByText("Modo demo")).toBeInTheDocument();
    expect(screen.getByText(DEMO_CREDENTIALS.email)).toBeInTheDocument();
    expect(screen.getByText(DEMO_CREDENTIALS.password)).toBeInTheDocument();
  });

  test("'Usar cuenta demo' rellena los campos con las credenciales demo", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole("button", { name: "Usar cuenta demo" }));

    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(DEMO_CREDENTIALS.email);
    expect(screen.getByLabelText("Contraseña")).toHaveValue(DEMO_CREDENTIALS.password);
  });

  test("las credenciales demo navegan a la página de inicio", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole("button", { name: "Usar cuenta demo" }));
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText("Página de inicio")).toBeInTheDocument();
  });

  test("unas credenciales incorrectas muestran un error y no navegan", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Correo electrónico"), "usuaria@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "secreta123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Correo o contraseña incorrectos. Usa la cuenta demo."
    );
    expect(screen.queryByText("Página de inicio")).not.toBeInTheDocument();
  });
});
