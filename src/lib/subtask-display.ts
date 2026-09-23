// Estilos y helpers de presentación de gestiones, compartidos entre la
// tarjeta (subtask-card), el detalle (subtask-detail-modal) y el formulario
// (subtask-form-modal), para no repetir la paleta de colores del Figma en
// cada componente.

import type { Priority, Subtask, SubtaskStatus } from "./types";

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

// "urgent" y "high" comparten el estilo visual "ALTA" del Figma (fondo vino,
// texto blanco); solo cambia la etiqueta de texto. `dot` es el color del
// punto usado en el select de prioridad y en el detalle de solo lectura.
export const PRIORITY_BADGE_STYLES: Record<Priority, { bg: string; text: string; dot: string }> = {
  low: { bg: "#f3f4f6", text: "#4a5565", dot: "#00d492" },
  medium: { bg: "#fef3c6", text: "#973c00", dot: "#ffb900" },
  high: { bg: "#8b1a1a", text: "#ffffff", dot: "#8b1a1a" },
  urgent: { bg: "#8b1a1a", text: "#ffffff", dot: "#da1515" },
};

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

const PRIORITY_RANK: Record<Priority, number> = { urgent: 3, high: 2, medium: 1, low: 0 };

/** Por fecha ascendente y, en empate, por prioridad descendente (más urgente primero). */
export function sortSubtasksByDateThenPriority(items: Subtask[]): Subtask[] {
  return [...items].sort((a, b) => {
    if (a.scheduled_date !== b.scheduled_date) {
      return a.scheduled_date < b.scheduled_date ? -1 : 1;
    }
    return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  });
}
