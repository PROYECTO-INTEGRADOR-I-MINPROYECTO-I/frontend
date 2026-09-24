// Estilos y helpers de presentación de gestiones, compartidos entre la
// tarjeta (subtask-card), el detalle (subtask-detail-modal) y el formulario
// (subtask-form-modal), para no repetir la paleta de colores del Figma en
// cada componente.

import type { Subtask, SubtaskStatus } from "./types";

// `category` es texto libre (no hay id de categoría en el backend todavía),
// así que el color del chip se asigna de forma determinística por nombre en
// vez de mantener un mapa fijo por cada categoría posible.
const CATEGORY_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: "#eff6ff", text: "#1447e6" },
  { bg: "#f5f3ff", text: "#7008e7" },
  { bg: "#ecfdf5", text: "#007a55" },
  { bg: "#fff7ed", text: "#ca3500" },
  { bg: "#fefce8", text: "#a65f00" },
  { bg: "#fdf2f8", text: "#c11574" },
];

export function categoryChipStyle(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

export type SubtaskTimeStatus = "overdue" | "today" | "upcoming" | "done";

export function subtaskTimeStatus(
  status: SubtaskStatus,
  scheduledDate: string,
  todayDate: string
): SubtaskTimeStatus {
  if (status === "done") return "done";
  if (scheduledDate < todayDate) return "overdue";
  if (scheduledDate > todayDate) return "upcoming";
  return "today";
}

export const TIME_STATUS_LABELS: Record<SubtaskTimeStatus, string> = {
  overdue: "Vencida",
  today: "Pendiente hoy",
  upcoming: "Próxima",
  done: "Completada",
};

export const TIME_STATUS_STYLES: Record<SubtaskTimeStatus, { bg: string; text: string }> = {
  overdue: { bg: "#fff0f0", text: "#8b1a1a" },
  today: { bg: "#fffbeb", text: "#bb4d00" },
  upcoming: { bg: "#eff6ff", text: "#1447e6" },
  done: { bg: "#ecfdf5", text: "#007a55" },
};

// Minutos mínimos/máximos permitidos en HoursPicker: 5 min (backend exige
// horas > 0) hasta 24 h (1440 min), siempre en pasos de 5 min.
const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 24 * 60;

/**
 * Convierte horas (string, tal como viaja `estimated_hours`) a minutos,
 * redondeando al múltiplo de 5 más cercano. Así "0.08" (2 decimales, lo
 * máximo que guarda el backend) vuelve a dar 5 min en vez de 4.8.
 */
export function hoursToMinutes(hoursString: string): number {
  const hours = Number(hoursString);
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  const minutes = Math.round((hours * 60) / 5) * 5;
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, minutes));
}

/**
 * Convierte minutos a horas con 2 decimales (lo que soporta
 * `estimated_hours`, un DecimalField(max_digits=4, decimal_places=2)).
 */
export function minutesToHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/** Etiqueta legible de una duración en horas: "5 min", "1 h", "2 h 30 min". */
export function formatDuration(hoursString: string): string {
  const totalMinutes = hoursToMinutes(hoursString);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

/** Por fecha ascendente y, en empate, por horas estimadas descendente (más horas primero). */
export function sortSubtasksByDateThenHours(items: Subtask[]): Subtask[] {
  return [...items].sort((a, b) => {
    if (a.scheduled_date !== b.scheduled_date) {
      return a.scheduled_date < b.scheduled_date ? -1 : 1;
    }
    return Number(b.estimated_hours) - Number(a.estimated_hours);
  });
}
