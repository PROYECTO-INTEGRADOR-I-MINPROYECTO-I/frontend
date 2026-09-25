// Traduce el error de guardar una gestión (hoy: completar/pausar, US-09) a un
// mensaje legible. Separado de api.ts para poder testearlo solo y
// reutilizarlo en cualquier flujo que use actualización optimista con
// reversión (ver estrategia de "servidor caído / sin internet" del ticket).

import { ApiError } from "./api";

export function describeSaveError(error: unknown): string {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  if (!(error instanceof ApiError)) {
    return offline
      ? "Sin conexión. No se guardó el cambio."
      : "Ocurrió un error inesperado. Intenta de nuevo.";
  }
  if (offline || error.code === "NETWORK_ERROR") {
    return "Sin conexión. No se guardó el cambio.";
  }
  if (error.status >= 500) {
    return "El servidor no respondió. No se guardó el cambio.";
  }
  if (error.status === 404) {
    return "Esta acción todavía no está disponible en el servidor.";
  }
  return error.message;
}
