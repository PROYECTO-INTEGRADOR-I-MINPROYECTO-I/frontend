import { describe, expect, test } from "vitest";
import {
  findMoveSuggestion,
  loadForDate,
  maxReducibleHours,
  predictConflict,
  type DailyCapacitySnapshot,
} from "./daily-capacity";

function snapshot(limit: number, entries: DailyCapacitySnapshot["entries"]): DailyCapacitySnapshot {
  return { limit, entries };
}

describe("predictConflict", () => {
  test("sin conflicto cuando la carga queda en el límite exacto (borde estricto, igual que el backend)", () => {
    const s = snapshot(6, [{ subtaskId: 1, date: "2026-10-10", hours: 4 }]);
    expect(predictConflict(s, "2026-10-10", 2, undefined)).toBeNull();
  });

  test("conflicto cuando la carga supera el límite, con el desglose correcto", () => {
    const s = snapshot(6, [{ subtaskId: 1, date: "2026-10-10", hours: 5 }]);
    expect(predictConflict(s, "2026-10-10", 2, undefined)).toEqual({
      date: "2026-10-10",
      existingHours: 5,
      plannedHours: 7,
      limit: 6,
    });
  });

  test("excluye la propia gestión del acumulado (editar/reprogramar sin doble conteo)", () => {
    const s = snapshot(6, [{ subtaskId: 42, date: "2026-10-10", hours: 5 }]);
    // La gestión 42 ya estaba ese día con 5h; reprogramarla a 2h el mismo día no debe sumarse a sí misma.
    expect(predictConflict(s, "2026-10-10", 2, 42)).toBeNull();
  });

  test("suma la carga de todos los eventos del organizador, no solo uno", () => {
    const s = snapshot(6, [
      { subtaskId: 1, date: "2026-10-10", hours: 3 }, // evento A
      { subtaskId: 2, date: "2026-10-10", hours: 2 }, // evento B
    ]);
    expect(predictConflict(s, "2026-10-10", 2, undefined)).toEqual({
      date: "2026-10-10",
      existingHours: 5,
      plannedHours: 7,
      limit: 6,
    });
  });
});

describe("findMoveSuggestion", () => {
  test("prefiere el día siguiente antes que el anterior", () => {
    const s = snapshot(6, []);
    expect(findMoveSuggestion(s, "2026-10-10", 2, "2026-10-01", "2026-10-31", undefined)).toBe("2026-10-11");
  });

  test("si el día siguiente no tiene capacidad, prueba el día anterior antes que +2", () => {
    const s = snapshot(6, [{ subtaskId: 1, date: "2026-10-11", hours: 6 }]);
    expect(findMoveSuggestion(s, "2026-10-10", 2, "2026-10-01", "2026-10-31", undefined)).toBe("2026-10-09");
  });

  test("nunca sugiere antes de hoy", () => {
    const s = snapshot(6, [
      { subtaskId: 1, date: "2026-10-11", hours: 6 },
      { subtaskId: 2, date: "2026-10-09", hours: 6 },
    ]);
    // 10-11 y 10-09 llenos; hoy es 10-10, así que no se puede ir más atrás que eso.
    expect(findMoveSuggestion(s, "2026-10-10", 2, "2026-10-10", "2026-10-31", undefined)).toBe("2026-10-12");
  });

  test("nunca sugiere después de la fecha del evento", () => {
    const s = snapshot(6, [{ subtaskId: 1, date: "2026-10-11", hours: 6 }]);
    // maxDate es el mismo día siguiente: no hay a dónde ir hacia adelante, y atrás tampoco (antes de hoy).
    expect(findMoveSuggestion(s, "2026-10-10", 2, "2026-10-10", "2026-10-11", undefined)).toBeNull();
  });

  test("null cuando ningún día del rango tiene capacidad", () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      subtaskId: i,
      date: `2026-10-${String(10 + i).padStart(2, "0")}`,
      hours: 6,
    }));
    const s = snapshot(6, entries);
    expect(findMoveSuggestion(s, "2026-10-12", 2, "2026-10-10", "2026-10-14", undefined)).toBeNull();
  });
});

describe("maxReducibleHours", () => {
  test("devuelve el máximo exacto que sí entra en el límite", () => {
    const s = snapshot(6, [{ subtaskId: 1, date: "2026-10-10", hours: 4 }]);
    expect(maxReducibleHours(s, "2026-10-10", undefined)).toBe(2);
  });

  test("null cuando el día ya está en el límite sin esta gestión: reducir no alcanza", () => {
    const s = snapshot(6, [{ subtaskId: 1, date: "2026-10-10", hours: 6 }]);
    expect(maxReducibleHours(s, "2026-10-10", undefined)).toBeNull();
  });

  test("excluye la propia gestión del cálculo", () => {
    const s = snapshot(6, [{ subtaskId: 42, date: "2026-10-10", hours: 6 }]);
    expect(maxReducibleHours(s, "2026-10-10", 42)).toBe(6);
  });
});

describe("loadForDate", () => {
  test("suma solo las horas de la fecha pedida", () => {
    const s = snapshot(6, [
      { subtaskId: 1, date: "2026-10-10", hours: 2 },
      { subtaskId: 2, date: "2026-10-11", hours: 3 },
    ]);
    expect(loadForDate(s, "2026-10-10", undefined)).toBe(2);
  });
});
