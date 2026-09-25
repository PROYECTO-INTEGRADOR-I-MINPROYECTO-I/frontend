// Mensaje del aviso emergente de creación exitosa (evento o gestión). Función
// pura para poder testear la concordancia de género ("el evento" / "la
// gestión") sin montar HomePage.

export type CreationKind = "event" | "subtask";

export function creationMessage(kind: CreationKind, name: string): string {
  const trimmed = name.trim();
  const article = kind === "event" ? "el evento" : "la gestión";
  if (!trimmed) return `Se ha creado exitosamente ${article}.`;
  return `Se ha creado exitosamente ${article} «${trimmed}».`;
}
