// Utilidades de fecha para las gestiones (PIM1-27). El backend manda
// `scheduled_date` como "YYYY-MM-DD" sin hora: `new Date("YYYY-MM-DD")` lo
// interpreta como medianoche UTC, lo que en Colombia (UTC-5) lo corre un día
// atrás al mostrarlo en hora local. Estas funciones evitan ese salto.

const SHORT_MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
];

/** Convierte "YYYY-MM-DD" a un Date a medianoche en hora local. */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** "YYYY-MM-DD" de hoy en hora local. */
export function todayLocalDateString(): string {
  return toLocalDateString(new Date());
}

/** Convierte un ISO datetime (con hora, como `Event.due_date`) a "YYYY-MM-DD" en hora local. */
export function isoDateTimeToLocalDateString(iso: string): string {
  return toLocalDateString(new Date(iso));
}

/** Convierte un ISO datetime a "HH:mm" en hora local, para precargar el input de hora al editar. */
export function isoDateTimeToLocalTimeString(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Convierte un Date a "YYYY-MM-DD" en hora local. Se exporta para reusarla en los datos semilla del modo mock. */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formato corto en español usado en las tarjetas: "19 sept". `dateStr` debe
 * ser "YYYY-MM-DD"; se compara como texto en otros lados porque ese formato
 * ya ordena cronológicamente sin necesidad de convertir a Date.
 */
export function formatShortDateEs(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return `${date.getDate()} ${SHORT_MONTHS_ES[date.getMonth()]}`;
}
