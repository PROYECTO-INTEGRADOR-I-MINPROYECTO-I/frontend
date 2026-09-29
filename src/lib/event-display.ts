// Color de portada para las cards de la vista "Eventos" (HU-13/PIM1-111).
// El modelo Events del backend no tiene un campo de imagen/color todavía
// (agregarlo es trabajo de Backend, fuera de alcance de este primer corte,
// que es 100% frontend reutilizando los endpoints que ya existen). Mientras
// tanto cada evento recibe un color sólido estable a partir de su nombre —
// mismo patrón que categoryChipStyle en subtask-display.ts.

const COVER_PALETTE = ["#8b1a1a", "#1447e6", "#7008e7", "#007a55", "#ca3500", "#a65f00", "#c11574"];

export function eventCoverColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return COVER_PALETTE[hash % COVER_PALETTE.length];
}
