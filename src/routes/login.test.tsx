// src/routes/login.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { test, expect } from "vitest";
import { LoginPage } from "./login";

test("renders login page elements", () => {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

  // Check heading
  expect(screen.getByText("¡Bienvenido!")).toBeInTheDocument();

  // Check inputs by placeholder (bypasses label association issues)
  expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();

  // Check button
  expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
});