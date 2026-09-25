import { describe, expect, test } from "vitest";
import { creationMessage } from "./success-messages";

describe("creationMessage", () => {
  test("usa artículo masculino y el nombre del evento", () => {
    expect(creationMessage("event", "Boda Luisa & Carlos")).toBe(
      "Se ha creado exitosamente el evento «Boda Luisa & Carlos»."
    );
  });

  test("usa artículo femenino y el título de la gestión", () => {
    expect(creationMessage("subtask", "Confirmar catering")).toBe(
      "Se ha creado exitosamente la gestión «Confirmar catering»."
    );
  });

  test("recorta espacios alrededor del nombre", () => {
    expect(creationMessage("event", "  Boda  ")).toBe("Se ha creado exitosamente el evento «Boda».");
  });

  test("si el nombre queda vacío tras recortar, usa el mensaje sin comillas", () => {
    expect(creationMessage("event", "   ")).toBe("Se ha creado exitosamente el evento.");
    expect(creationMessage("subtask", "")).toBe("Se ha creado exitosamente la gestión.");
  });
});
