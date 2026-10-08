// Sprint 3 (C3/C4): predicción de sobrecarga diaria y búsqueda de
// alternativas de resolución, calculadas en el cliente con el mismo
// criterio que planning/services.py (evaluate_conflict): límite GLOBAL por
// organizador (todos sus eventos, no solo el de la gestión que se edita),
// solo cuentan gestiones pendientes y ejecutadas (las pospuestas no
// consumen capacidad), comparación estricta (> no >=).
//
// Se usa en 4 flujos (crear, editar, el wizard de creación y reprogramar):
// ninguno de los endpoints de creación/edición genéricos bloquea de verdad
// por sobrecarga salvo el POST de creación y PATCH /reprogram/ (que sí dan
// un 409 real) — y aun ahí, el backend solo sugiere fechas hacia adelante.
// checkOverloadConflict() predice el conflicto ANTES de guardar, con el
// mismo criterio que evaluate_conflict() en planning/services.py, y calcula
// la sugerencia de "mover" con un algoritmo propio (ping-pong: día
// siguiente, anterior, dos después...) acotado entre hoy y la fecha del
// evento.

import { apiFetch } from "./api";
import { addDaysToLocalDate, daysBetweenLocalDates, isoDateTimeToLocalDateString, todayLocalDateString } from "./dates";
import type { TodaySummary } from "./types";

export interface DailyCapacityEntry {
  subtaskId: number;
  date: string;
  hours: number;
}

export interface DailyCapacitySnapshot {
  entries: DailyCapacityEntry[];
  limit: number;
}

// Igual que _LOAD_STATUSES en planning/services.py.
const LOAD_STATUSES = new Set(["pending", "done"]);

const MAX_WINDOW_DAYS = 60; // mismo tope que valida el backend para `dias_proximos`.

/**
 * Trae la carga diaria del organizador (todos sus eventos, sin filtrar por
 * uno solo) para los próximos `windowDays` días, vía GET /api/hoy/.
 */
export async function fetchDailyCapacity(limit: number, windowDays: number): Promise<DailyCapacitySnapshot> {
  const clampedWindow = Math.min(MAX_WINDOW_DAYS, Math.max(1, Math.ceil(windowDays)));
  const summary = await apiFetch<TodaySummary>(`/hoy/?dias_proximos=${clampedWindow}`);
  const relevant = [...summary.para_hoy.pendientes, ...summary.para_hoy.completadas, ...summary.proximas];
  const entries: DailyCapacityEntry[] = relevant
    .filter((subtask) => LOAD_STATUSES.has(subtask.status))
    .map((subtask) => ({
      subtaskId: subtask.subtask_id,
      date: subtask.scheduled_date,
      hours: Number(subtask.estimated_hours),
    }));
  return { entries, limit };
}

/** Horas ya planificadas ese día, sin contar `excludeSubtaskId` (la propia gestión que se edita o reprograma). */
export function loadForDate(snapshot: DailyCapacitySnapshot, date: string, excludeSubtaskId?: number): number {
  return snapshot.entries.reduce((total, entry) => {
    if (entry.date !== date || entry.subtaskId === excludeSubtaskId) return total;
    return total + entry.hours;
  }, 0);
}

export interface ConflictInfo {
  date: string;
  /** Horas ya planificadas ese día, sin esta gestión. */
  existingHours: number;
  /** Horas planificadas con esta gestión incluida. */
  plannedHours: number;
  limit: number;
}

/** null si no hay conflicto; el resumen si `existingHours + hours` supera el límite (estrictamente). */
export function predictConflict(
  snapshot: DailyCapacitySnapshot,
  date: string,
  hours: number,
  excludeSubtaskId?: number
): ConflictInfo | null {
  const existingHours = loadForDate(snapshot, date, excludeSubtaskId);
  const plannedHours = existingHours + hours;
  if (plannedHours <= snapshot.limit) return null;
  return { date, existingHours, plannedHours, limit: snapshot.limit };
}

/**
 * Busca el día más cercano, adelante o atrás, con capacidad para `hours`:
 * día siguiente, día anterior, dos días siguientes, dos días antes, y así.
 * Nunca antes de `todayDate` ni después de `maxDate` (la fecha del evento de
 * la gestión). null si ningún día del rango tiene capacidad.
 */
export function findMoveSuggestion(
  snapshot: DailyCapacitySnapshot,
  fromDate: string,
  hours: number,
  todayDate: string,
  maxDate: string,
  excludeSubtaskId?: number
): string | null {
  const fits = (date: string) => snapshot.limit - loadForDate(snapshot, date, excludeSubtaskId) >= hours;

  for (let offset = 1; offset <= 366; offset += 1) {
    const forward = addDaysToLocalDate(fromDate, offset);
    const forwardInRange = forward <= maxDate;
    if (forwardInRange && fits(forward)) return forward;

    const backward = addDaysToLocalDate(fromDate, -offset);
    const backwardInRange = backward >= todayDate;
    if (backwardInRange && fits(backward)) return backward;

    if (!forwardInRange && !backwardInRange) return null;
  }
  return null;
}

/**
 * Máximo de horas al que se podría reducir la gestión para que ese día ya no
 * supere el límite. null si el día ya está en el límite (o por encima) aun
 * sin esta gestión: reducir horas no alcanzaría a resolver nada.
 */
export function maxReducibleHours(
  snapshot: DailyCapacitySnapshot,
  date: string,
  excludeSubtaskId?: number
): number | null {
  const max = snapshot.limit - loadForDate(snapshot, date, excludeSubtaskId);
  return max > 0 ? Math.round(max * 100) / 100 : null;
}

/** "2.5 horas", "6 horas": el formato plano que pide la UI de resolución de conflictos (distinto de "2 h 30 min" en otros lados de la app). */
export function formatPlainHours(hours: number): string {
  return `${Number(hours.toFixed(2))} horas`;
}

export interface OverloadConflictCheck {
  conflict: ConflictInfo;
  moveSuggestion: string | null;
  maxReduceHours: number | null;
}

/**
 * Trae la capacidad diaria, predice el conflicto para `date`/`hours` y, si
 * lo hay, calcula de una vez la sugerencia de "mover" y el máximo de
 * "reducir horas" (ver OverloadConflictWizard). null si no hay conflicto.
 * Único punto de entrada para los 4 flujos que necesitan esto (crear,
 * editar, el wizard de creación y reprogramar) — así los cuatro quedan con
 * el mismo criterio y la misma ventana de búsqueda.
 */
export async function checkOverloadConflict(params: {
  date: string;
  hours: number;
  limit: number;
  /** `Event.due_date` (ISO datetime): tope de la sugerencia de "mover". Sin esto, tope de 60 días desde hoy. */
  eventDueDate?: string;
  /** La propia gestión, para no contarla dos veces (editar/reprogramar); sin esto en crear. */
  excludeSubtaskId?: number;
}): Promise<OverloadConflictCheck | null> {
  const today = todayLocalDateString();
  const maxDate = params.eventDueDate
    ? isoDateTimeToLocalDateString(params.eventDueDate)
    : addDaysToLocalDate(today, MAX_WINDOW_DAYS);
  const windowDays = Math.max(1, daysBetweenLocalDates(today, maxDate));

  const snapshot = await fetchDailyCapacity(params.limit, windowDays);
  const conflict = predictConflict(snapshot, params.date, params.hours, params.excludeSubtaskId);
  if (!conflict) return null;

  return {
    conflict,
    moveSuggestion: findMoveSuggestion(
      snapshot,
      conflict.date,
      params.hours,
      today,
      maxDate,
      params.excludeSubtaskId
    ),
    maxReduceHours: maxReducibleHours(snapshot, conflict.date, params.excludeSubtaskId),
  };
}
