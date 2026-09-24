import { describe, expect, test } from "vitest";
import {
  categoryChipStyle,
  DURATION_STOPS,
  formatDuration,
  hoursToMinutes,
  minutesToHours,
  nearestDurationStopIndex,
  sortCompletedSubtasksByDateDesc,
  sortSubtasksByDateThenHours,
  subtaskTimeStatus,
} from "./subtask-display";
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

describe("nearestDurationStopIndex", () => {
  test("un stop exacto se mapea a sí mismo", () => {
    expect(DURATION_STOPS[nearestDurationStopIndex(60)]).toBe(60);
    expect(DURATION_STOPS[nearestDurationStopIndex(480)]).toBe(480);
  });

  test("un valor entre dos stops elige el más cercano", () => {
    // 155 min está entre 150 y 165 (tramo 75..240 de 15 en 15); más cerca de 150.
    expect(DURATION_STOPS[nearestDurationStopIndex(155)]).toBe(150);
  });
});

describe("sortCompletedSubtasksByDateDesc", () => {
  test("ordena por fecha descendente (la más reciente primero)", () => {
    const older = makeSubtask({ subtask_id: 1, scheduled_date: "2026-09-10", status: "done" });
    const newer = makeSubtask({ subtask_id: 2, scheduled_date: "2026-09-25", status: "done" });

    const sorted = sortCompletedSubtasksByDateDesc([older, newer]);

    expect(sorted.map((item) => item.subtask_id)).toEqual([2, 1]);
  });

  test("en empate de fecha, ordena por más horas primero", () => {
    const fewHours = makeSubtask({ subtask_id: 1, scheduled_date: "2026-09-20", estimated_hours: "1", status: "done" });
    const moreHours = makeSubtask({ subtask_id: 2, scheduled_date: "2026-09-20", estimated_hours: "3", status: "done" });

    const sorted = sortCompletedSubtasksByDateDesc([fewHours, moreHours]);

    expect(sorted.map((item) => item.subtask_id)).toEqual([2, 1]);
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

describe("hoursToMinutes / minutesToHours", () => {
  test.each([5, 10, 15, 20, 45, 90, 150])("ida y vuelta sin deriva para %i minutos", (minutes) => {
    const hours = minutesToHours(minutes);
    expect(hoursToMinutes(hours)).toBe(minutes);
  });

  test("redondea al múltiplo de 5 más cercano (0.08 h -> 5 min, no 4.8)", () => {
    expect(hoursToMinutes("0.08")).toBe(5);
  });
});

describe("formatDuration", () => {
  test("minutos puros: 5 -> '5 min', 45 -> '45 min'", () => {
    expect(formatDuration(minutesToHours(5))).toBe("5 min");
    expect(formatDuration(minutesToHours(45))).toBe("45 min");
  });

  test("horas exactas: 60 -> '1 h'", () => {
    expect(formatDuration(minutesToHours(60))).toBe("1 h");
  });

  test("horas y minutos: 150 -> '2 h 30 min'", () => {
    expect(formatDuration(minutesToHours(150))).toBe("2 h 30 min");
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
