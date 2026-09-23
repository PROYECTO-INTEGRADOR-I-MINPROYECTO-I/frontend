// Enrutador del modo mock: recibe lo mismo que mandaría `fetch` (path,
// método y body ya serializado) y devuelve un `Response` real, para que
// apiFetch procese el resultado exactamente igual que con el backend real
// (parseo de errores, ApiError, 204, etc.).

import { getDb, saveDb } from "./store";
import type { MockDb } from "./seed-data";
import type { Category, Event, EventType, Priority, Subtask, SubtaskStatus } from "../lib/types";

const MOCK_DELAY_MS = Number(import.meta.env.VITE_MOCK_DELAY ?? 400);

console.info(
  '[mock] Modo mock activo: los datos viven en localStorage ("planificapp:mock-db:v1"). Usa ?mock-reset para reiniciarlos y ?mock-fail=network|load para simular fallas.'
);

const EVENTOS_RE = /^\/eventos\/$/;
const EVENTO_RE = /^\/eventos\/(\d+)\/$/;
const SUBTAREAS_RE = /^\/eventos\/(\d+)\/subtareas\/$/;
const SUBTAREA_RE = /^\/subtareas\/(\d+)\/$/;
const TIPOS_EVENTO_RE = /^\/tipos-evento\/$/;
const CATEGORIAS_RE = /^\/categorias\/$/;

// Respeta un AbortSignal durante la espera simulada, igual que haría un
// fetch real: si se cancela, rechaza con el mismo DOMException que dispara
// la rama de "no es una falla de red" en apiFetch.
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timeoutId = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function getMockFailMode(): string | null {
  return new URLSearchParams(window.location.search).get("mock-fail");
}

export async function handleMockRequest(
  path: string,
  method: string,
  body: BodyInit | null | undefined,
  signal?: AbortSignal
): Promise<Response> {
  await sleep(MOCK_DELAY_MS, signal);

  const isWrite = method !== "GET";
  const failMode = getMockFailMode();
  if ((isWrite && failMode === "network") || (!isWrite && failMode === "load")) {
    // Mismo tipo de error que lanza fetch ante una falla real de red, para
    // que apiFetch lo traduzca a NETWORK_ERROR sin ramas especiales.
    throw new TypeError("Failed to fetch");
  }

  const parsedBody: Record<string, unknown> =
    typeof body === "string" && body.length > 0 ? (JSON.parse(body) as Record<string, unknown>) : {};

  const db = getDb();
  const response = route(db, path, method, parsedBody);
  if (isWrite) saveDb(db);
  return response;
}

function route(db: MockDb, path: string, method: string, body: Record<string, unknown>): Response {
  if (EVENTOS_RE.test(path)) {
    if (method === "GET") return jsonResponse(sortByCreatedAtDesc(db.events), 200);
    if (method === "POST") return createEvent(db, body);
  }

  const eventoMatch = path.match(EVENTO_RE);
  if (eventoMatch) {
    const eid = Number(eventoMatch[1]);
    if (method === "PATCH") return updateEvent(db, eid, body);
    if (method === "DELETE") return deleteEvent(db, eid);
  }

  const subtareasMatch = path.match(SUBTAREAS_RE);
  if (subtareasMatch) {
    const eid = Number(subtareasMatch[1]);
    if (method === "GET") return jsonResponse(db.subtasks.filter((subtask) => subtask.eid === eid), 200);
    if (method === "POST") return createSubtask(db, eid, body);
  }

  const subtareaMatch = path.match(SUBTAREA_RE);
  if (subtareaMatch) {
    const subtaskId = Number(subtareaMatch[1]);
    if (method === "PATCH") return updateSubtask(db, subtaskId, body);
    if (method === "DELETE") return deleteSubtask(db, subtaskId);
  }

  if (TIPOS_EVENTO_RE.test(path)) {
    if (method === "GET") return jsonResponse(db.eventTypes, 200);
    if (method === "POST") return createEventType(db, body);
  }

  if (CATEGORIAS_RE.test(path)) {
    if (method === "GET") return jsonResponse(db.categories, 200);
    if (method === "POST") return createCategory(db, body);
  }

  return notFoundError();
}

function createEvent(db: MockDb, body: Record<string, unknown>): Response {
  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) return validationError({ name: "Escribe el nombre del evento." });

  const event: Event = {
    eid: db.nextEventId++,
    user: 1,
    name: name.trim(),
    description: typeof body.description === "string" ? body.description : "",
    due_date: typeof body.due_date === "string" ? body.due_date : new Date().toISOString(),
    status: "pending",
    progress_percentage: 0,
    created_at: new Date().toISOString(),
    event_type: typeof body.event_type === "number" ? body.event_type : null,
    place: typeof body.place === "string" ? body.place : null,
    client_contact: typeof body.client_contact === "string" ? body.client_contact : null,
  };
  db.events.push(event);
  return jsonResponse(event, 201);
}

function updateEvent(db: MockDb, eid: number, body: Record<string, unknown>): Response {
  const event = db.events.find((item) => item.eid === eid);
  if (!event) return notFoundError();

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name : "";
    if (!name.trim()) return validationError({ name: "Escribe el nombre del evento." });
    event.name = name.trim();
  }
  if ("description" in body && typeof body.description === "string") event.description = body.description;
  if ("due_date" in body && typeof body.due_date === "string") event.due_date = body.due_date;
  if ("place" in body && typeof body.place === "string") event.place = body.place;
  if ("client_contact" in body && typeof body.client_contact === "string") event.client_contact = body.client_contact;
  if ("event_type" in body && typeof body.event_type === "number") event.event_type = body.event_type;

  return jsonResponse(event, 200);
}

function deleteEvent(db: MockDb, eid: number): Response {
  const index = db.events.findIndex((item) => item.eid === eid);
  if (index === -1) return notFoundError();
  db.events.splice(index, 1);
  db.subtasks = db.subtasks.filter((subtask) => subtask.eid !== eid); // borrado en cascada
  return new Response(null, { status: 204 });
}

function createSubtask(db: MockDb, eid: number, body: Record<string, unknown>): Response {
  const event = db.events.find((item) => item.eid === eid);
  if (!event) return notFoundError();

  const fields: Record<string, string> = {};
  const title = typeof body.title === "string" ? body.title : "";
  if (!title.trim()) fields.title = "Escribe el nombre de la gestión.";
  const hours = Number(body.estimated_hours);
  if (!Number.isFinite(hours) || hours <= 0) {
    fields.estimated_hours = "Las horas estimadas deben ser mayores a 0.";
  }
  if (Object.keys(fields).length > 0) return validationError(fields);

  const scheduledDate = typeof body.scheduled_date === "string" ? body.scheduled_date : "";
  const subtask: Subtask = {
    subtask_id: db.nextSubtaskId++,
    eid,
    title: title.trim(),
    description: typeof body.description === "string" ? body.description : "",
    category: typeof body.category === "string" ? body.category : "",
    estimated_hours: String(hours),
    scheduled_date: scheduledDate,
    status: isSubtaskStatus(body.status) ? body.status : "pending",
    priority: isPriority(body.priority) ? body.priority : "medium",
  };
  db.subtasks.push(subtask);

  // El evento guarda due_date como ISO datetime; solo se compara la parte de fecha.
  const eventDueDate = event.due_date.slice(0, 10);
  const warnings: string[] = [];
  if (scheduledDate && scheduledDate > eventDueDate) {
    warnings.push("La fecha objetivo es posterior a la fecha del evento");
  }

  return jsonResponse(warnings.length > 0 ? { ...subtask, warnings } : subtask, 201);
}

function updateSubtask(db: MockDb, subtaskId: number, body: Record<string, unknown>): Response {
  const subtask = db.subtasks.find((item) => item.subtask_id === subtaskId);
  if (!subtask) return notFoundError();

  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title : "";
    if (!title.trim()) return validationError({ title: "Escribe el nombre de la gestión." });
    subtask.title = title.trim();
  }
  if ("description" in body && typeof body.description === "string") subtask.description = body.description;
  if ("category" in body && typeof body.category === "string") subtask.category = body.category;
  if ("estimated_hours" in body) {
    const hours = Number(body.estimated_hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return validationError({ estimated_hours: "Las horas estimadas deben ser mayores a 0." });
    }
    subtask.estimated_hours = String(hours);
  }
  if ("scheduled_date" in body && typeof body.scheduled_date === "string") {
    subtask.scheduled_date = body.scheduled_date;
  }
  if ("priority" in body && isPriority(body.priority)) subtask.priority = body.priority;
  if ("status" in body && isSubtaskStatus(body.status)) subtask.status = body.status;

  return jsonResponse(subtask, 200);
}

function deleteSubtask(db: MockDb, subtaskId: number): Response {
  const index = db.subtasks.findIndex((item) => item.subtask_id === subtaskId);
  if (index === -1) return notFoundError();
  db.subtasks.splice(index, 1);
  return new Response(null, { status: 204 });
}

function createEventType(db: MockDb, body: Record<string, unknown>): Response {
  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) return validationError({ name: "Escribe el nombre del tipo de evento." });
  const trimmed = name.trim();

  const exists = db.eventTypes.some((type) => normalize(type.name) === normalize(trimmed));
  if (exists) return errorResponse(409, "CONFLICT", "Ya tienes un tipo de evento con ese nombre");

  const eventType: EventType = { id: db.nextEventTypeId++, name: trimmed };
  db.eventTypes.push(eventType);
  return jsonResponse(eventType, 201);
}

function createCategory(db: MockDb, body: Record<string, unknown>): Response {
  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) return validationError({ name: "Escribe el nombre de la categoría." });
  const trimmed = name.trim();

  const exists = db.categories.some((category) => normalize(category.name) === normalize(trimmed));
  if (exists) return errorResponse(409, "CONFLICT", "Ya tienes una categoría con ese nombre");

  // El id es el propio nombre: `category` en Subtask es texto libre (ver
  // CATEGORY_FALLBACKS en subtask-form-modal.tsx), así el formulario puede
  // enviar directamente el id elegido como valor del campo.
  const category: Category = { id: trimmed, name: trimmed };
  db.categories.push(category);
  return jsonResponse(category, 201);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isPriority(value: unknown): value is Priority {
  return value === "low" || value === "medium" || value === "high" || value === "urgent";
}

function isSubtaskStatus(value: unknown): value is SubtaskStatus {
  return value === "pending" || value === "done" || value === "postponed";
}

function sortByCreatedAtDesc(events: Event[]): Event[] {
  return [...events].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function validationError(fields: Record<string, string>): Response {
  return errorResponse(400, "VALIDATION_ERROR", "Revisa los campos marcados.", fields);
}

function notFoundError(): Response {
  return errorResponse(404, "NOT_FOUND", "No encontramos lo que buscabas.");
}

function errorResponse(status: number, code: string, message: string, fields?: Record<string, string>): Response {
  return jsonResponse({ error: { code, message, ...(fields ? { fields } : {}) } }, status);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
