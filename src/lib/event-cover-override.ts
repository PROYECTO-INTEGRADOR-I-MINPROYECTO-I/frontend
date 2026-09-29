// Portada personalizada por evento (color sólido o enlace a imagen),
// elegida a mano por el usuario desde EventCover. El modelo Events del
// backend no tiene un campo de imagen/color (agregarlo es trabajo de
// Backend, fuera de alcance — ver eventCoverColor en event-display.ts, que
// es el valor por defecto cuando no hay personalización). Mientras tanto se
// guarda en localStorage, por evento y por navegador: no sincroniza entre
// dispositivos ni persiste si se limpian los datos del sitio.

export type EventCoverOverride = { kind: "color"; value: string } | { kind: "image"; value: string };

const STORAGE_PREFIX = "planificapp:event-cover:";

function storageKey(eid: number): string {
  return `${STORAGE_PREFIX}${eid}`;
}

export function getEventCoverOverride(eid: number): EventCoverOverride | null {
  try {
    const raw = window.localStorage.getItem(storageKey(eid));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      ("kind" in parsed) &&
      (parsed.kind === "color" || parsed.kind === "image") &&
      "value" in parsed &&
      typeof parsed.value === "string"
    ) {
      return parsed as EventCoverOverride;
    }
    return null;
  } catch {
    // localStorage bloqueado (navegación privada, cuota, etc.) o el JSON
    // guardado no tiene la forma esperada: se usa el color por defecto.
    return null;
  }
}

export function setEventCoverOverride(eid: number, override: EventCoverOverride | null): void {
  try {
    if (override) {
      window.localStorage.setItem(storageKey(eid), JSON.stringify(override));
    } else {
      window.localStorage.removeItem(storageKey(eid));
    }
  } catch {
    // Igual que arriba: si no se puede escribir, la personalización
    // simplemente no persiste, no es un error fatal para la vista.
  }
}
