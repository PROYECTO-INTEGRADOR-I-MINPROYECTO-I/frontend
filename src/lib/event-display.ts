// Color de portada para las cards de la vista "Eventos" (HU-13/PIM1-111).
// El modelo Events del backend no tiene un campo de imagen/color todavía
// (agregarlo es trabajo de Backend, fuera de alcance de este primer corte,
// que es 100% frontend reutilizando los endpoints que ya existen). Mientras
// tanto cada evento recibe un color sólido estable a partir de su nombre —
// mismo patrón que categoryChipStyle en subtask-display.ts.

export const COVER_PALETTE = ["#8b1a1a", "#1447e6", "#7008e7", "#007a55", "#ca3500", "#a65f00", "#c11574"];

export function eventCoverColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return COVER_PALETTE[hash % COVER_PALETTE.length];
}

// Doodles sobre la portada (corrección del profesor en la clínica pasada:
// un color plano solo se sentía vacío). Solo aplica con color plano, nunca
// con imagen (ver EventCover) — se eligen por el NOMBRE del tipo de evento,
// porque EventType no tiene un campo de categoría propio en el backend, solo
// `name` (ver event/migrations/0002_seed_predefinidos.py: los predefinidos
// son "Boda", "Social", "Corporativo", "Cumpleaños", "Otro"). Un tipo
// personalizado que no calce con ninguno de estos, "Otro", o un evento sin
// tipo asignado, caen en "alternative".
export type EventDoodleKind = "social" | "corporate" | "alternative";

const SOCIAL_EVENT_TYPE_NAMES = new Set(["boda", "social", "cumpleaños", "cumpleanos"]);
const CORPORATE_EVENT_TYPE_NAMES = new Set(["corporativo"]);

export function eventDoodleKind(eventTypeName: string | null | undefined): EventDoodleKind {
  if (!eventTypeName) return "alternative";
  const normalized = eventTypeName.trim().toLowerCase();
  if (SOCIAL_EVENT_TYPE_NAMES.has(normalized)) return "social";
  if (CORPORATE_EVENT_TYPE_NAMES.has(normalized)) return "corporate";
  return "alternative";
}
