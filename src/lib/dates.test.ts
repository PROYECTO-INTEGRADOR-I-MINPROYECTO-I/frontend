import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { formatShortDateEs, parseLocalDate, todayLocalDateString, toLocalDateString } from "./dates";

describe("parseLocalDate", () => {
  test("interpreta 'YYYY-MM-DD' como medianoche en hora local, sin el corrimiento de UTC-5", () => {
    const date = parseLocalDate("2026-09-19");

    // Si se interpretara como UTC (new Date("2026-09-19")), en UTC-5 esto
    // mostraría el 18, no el 19.
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8); // septiembre, 0-indexado
    expect(date.getDate()).toBe(19);
  });
});

describe("toLocalDateString", () => {
  test("convierte un Date a 'YYYY-MM-DD' en hora local", () => {
    const date = new Date(2026, 8, 19);
    expect(toLocalDateString(date)).toBe("2026-09-19");
  });

  test("agrega ceros a la izquierda en mes y día", () => {
    const date = new Date(2026, 0, 5);
    expect(toLocalDateString(date)).toBe("2026-01-05");
  });
});

describe("formatShortDateEs", () => {
  test("formatea como 'día mes-corto' en español", () => {
    expect(formatShortDateEs("2026-09-19")).toBe("19 sept");
  });

  test("usa el mes corto correspondiente para otro mes", () => {
    expect(formatShortDateEs("2026-01-05")).toBe("5 ene");
  });
});

describe("todayLocalDateString", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("devuelve la fecha de hoy en hora local", () => {
    vi.setSystemTime(new Date(2026, 8, 17, 10, 30));
    expect(todayLocalDateString()).toBe("2026-09-17");
  });
});
