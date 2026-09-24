import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import { LoginPage } from "./login";

// login.tsx todavía es un stub (TODO: Connect to backend authentication API):
// no hace ningún fetch ni maneja errores de servidor, solo navega a "/" al
// enviar. Por eso estos tests cubren lo que existe hoy, no un flujo de login
// real contra el backend.

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  test("renderiza el encabezado, los campos y el botón de envío", () => {
    renderLoginPage();

    expect(screen.getByText("¡Bienvenido!")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  test("los campos tienen su etiqueta de texto correspondiente", () => {
    renderLoginPage();

    expect(screen.getByText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByText("Contraseña")).toBeInTheDocument();
  });

  test("permite escribir en los campos y enviar el formulario", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const emailInput = screen.getByPlaceholderText("you@example.com");
    const passwordInput = screen.getByPlaceholderText("••••••••");

    await user.type(emailInput, "usuaria@example.com");
    await user.type(passwordInput, "secreta123");

    expect(emailInput).toHaveValue("usuaria@example.com");
    expect(passwordInput).toHaveValue("secreta123");

    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    // Hoy el envío no llama a ningún endpoint (no hay integración con el
    // backend todavía): solo verificamos que el submit no rompe el formulario.
    expect(emailInput).toHaveValue("usuaria@example.com");
  });
});
