import { describe, expect, test } from "vitest";
import { categoryChipStyle, sortSubtasksByDateThenHours, subtaskTimeStatus } from "./subtask-display";
import type { Subtask } from "./types";

function makeSubtask(overrides: Partial<Subtask>): Subtask {
  return {
    subtask_id: 1,
    eid: 1,
    title: "Gestión",
    description: "",
    category: "Lugar",
    estimated_hours: "1",
    scheduled_date: "2026-09-20",
    status: "pending",
    ...overrides,
  };
}

describe("sortSubtasksByDateThenHours", () => {
  test("ordena por fecha ascendente", () => {
    const later = makeSubtask({ subtask_id: 1, scheduled_date: "2026-09-25" });
    const sooner = makeSubtask({ subtask_id: 2, scheduled_date: "2026-09-20" });

    const sorted = sortSubtasksByDateThenHours([later, sooner]);

    expect(sorted.map((item) => item.subtask_id)).toEqual([2, 1]);
  });

  test("en empate de fecha, ordena por más horas primero", () => {
    const fewHours = makeSubtask({ subtask_id: 1, scheduled_date: "2026-09-20", estimated_hours: "1" });
    const moreHours = makeSubtask({ subtask_id: 2, scheduled_date: "2026-09-20", estimated_hours: "3" });

    const sorted = sortSubtasksByDateThenHours([fewHours, moreHours]);

    expect(sorted.map((item) => item.subtask_id)).toEqual([2, 1]);
  });

  test("compara horas decimales como número, no como texto", () => {
    // Como texto "2.5" < "2" (compara caracter a caracter), pero como
    // número 2.5 > 2: el resultado debe respetar el valor numérico.
    const twoHours = makeSubtask({ subtask_id: 1, scheduled_date: "2026-09-20", estimated_hours: "2" });
    const twoAndHalfHours = makeSubtask({ subtask_id: 2, scheduled_date: "2026-09-20", estimated_hours: "2.5" });

    const sorted = sortSubtasksByDateThenHours([twoHours, twoAndHalfHours]);

    expect(sorted.map((item) => item.subtask_id)).toEqual([2, 1]);
  });

  test("no muta el array original", () => {
    const items = [
      makeSubtask({ subtask_id: 1, scheduled_date: "2026-09-25" }),
      makeSubtask({ subtask_id: 2, scheduled_date: "2026-09-20" }),
    ];
    const original = [...items];

    sortSubtasksByDateThenHours(items);

    expect(items).toEqual(original);
  });
});

describe("subtaskTimeStatus", () => {
  const today = "2026-09-20";

  test("done cuando el status es done, sin importar la fecha", () => {
    expect(subtaskTimeStatus("done", "2026-09-10", today)).toBe("done");
  });

  test("overdue cuando la fecha es anterior a hoy y no está done", () => {
    expect(subtaskTimeStatus("pending", "2026-09-10", today)).toBe("overdue");
  });

  test("today cuando la fecha es igual a hoy", () => {
    expect(subtaskTimeStatus("pending", "2026-09-20", today)).toBe("today");
  });

  test("upcoming cuando la fecha es posterior a hoy", () => {
    expect(subtaskTimeStatus("pending", "2026-09-25", today)).toBe("upcoming");
  });
});

describe("categoryChipStyle", () => {
  test("es determinístico: el mismo nombre siempre devuelve el mismo estilo", () => {
    const first = categoryChipStyle("Catering");
    const second = categoryChipStyle("Catering");

    expect(first).toEqual(second);
  });

  test("devuelve un estilo de la paleta definida", () => {
    const style = categoryChipStyle("Catering");

    expect(style).toHaveProperty("bg");
    expect(style).toHaveProperty("text");
  });
});
