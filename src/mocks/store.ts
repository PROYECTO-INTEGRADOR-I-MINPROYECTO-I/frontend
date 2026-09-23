// Persistencia del modo mock en localStorage, con una sola clave versionada.
// Si localStorage no está disponible (modo privado, cuota llena, etc.) se
// sigue trabajando en memoria para la sesión actual.

import { createSeedData, type MockDb } from "./seed-data";

const STORAGE_KEY = "planificapp:mock-db:v1";

let db: MockDb | null = null;
let pendingReset = false;

/**
 * Consume `?mock-reset` de la URL: marca el reinicio pendiente y quita el
 * parámetro con history.replaceState (conservando los demás) para que no se
 * "pegue" a la URL. Debe llamarse una sola vez, antes de montar React (ver
 * src/main.tsx), porque react-router lee los search params al montar y los
 * volvería a escribir en cada setSearchParams (p. ej. al seleccionar un
 * evento) si el parámetro seguía presente.
 */
export function consumeMockResetParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("mock-reset")) return;
  pendingReset = true;
  url.searchParams.delete("mock-reset");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function readFromStorage(): MockDb | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockDb) : null;
  } catch {
    return null;
  }
}

function writeToStorage(next: MockDb): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin localStorage disponible: se continúa solo en memoria.
  }
}

function loadInitialDb(): MockDb {
  if (pendingReset) {
    const fresh = createSeedData();
    writeToStorage(fresh);
    return fresh;
  }
  return readFromStorage() ?? createSeedData();
}

/** Base de datos en memoria de la sesión actual; se inicializa (o se resetea) una sola vez por carga de página. */
export function getDb(): MockDb {
  if (!db) db = loadInitialDb();
  return db;
}

/** Persiste el estado actual de la base (mutada en el sitio por el handler). */
export function saveDb(next: MockDb): void {
  db = next;
  writeToStorage(next);
}
