// Puente entre ApiError y react-hook-form: evita repetir en cada vista
// la lógica de recorrer error.fields y pintar cada mensaje en su input.

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./api";

/**
 * Pinta en el formulario los errores de ApiError que correspondan a campos
 * conocidos del formulario (knownFields). Devuelve true si pintó al menos
 * uno; si devuelve false, el caller debería mostrar error.message en un
 * banner, porque no hubo campo conocido donde pintarlo (por ejemplo un
 * error de campo anidado que la vista no tiene, o un NETWORK_ERROR).
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[]
): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }

  let applied = false;
  for (const field of knownFields) {
    const message = error.fields[field];
    if (message === undefined) continue;
    setError(field as Path<T>, { type: "server", message });
    applied = true;
  }

  return applied;
}
