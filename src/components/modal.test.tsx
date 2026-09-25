import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Modal } from "./modal";

describe("Modal", () => {
  test("bloquea el scroll de la página mientras está abierto y lo restaura al cerrar", () => {
    document.body.style.overflow = "auto";
    const { rerender } = render(
      <Modal open onClose={() => {}} title="Nueva gestión">
        <p>Contenido</p>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal open={false} onClose={() => {}} title="Nueva gestión">
        <p>Contenido</p>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("auto");
  });

  test("el cuerpo scrollea por dentro y el diálogo no pasa del alto de la pantalla", () => {
    render(
      <Modal open onClose={() => {}} title="Nueva gestión" footer={<button type="button">Guardar</button>}>
        <p>Contenido</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-h-[calc(100dvh-1rem)]");
    expect(dialog.className).toContain("flex-col");
    expect(screen.getByText("Contenido").parentElement?.className).toContain("overflow-y-auto");
  });
});
