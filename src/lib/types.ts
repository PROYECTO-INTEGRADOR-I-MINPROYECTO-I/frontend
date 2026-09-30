// Tipos compartidos entre las vistas de eventos. Los nombres de campo del
// evento siguen el contrato real del backend (modelo Events); los de tipo de
// evento siguen el ticket PIM1-89, coordinados a futuro con backend.

/**
 * Evento tal como lo devuelve el backend hoy (GET/POST /eventos/).
 *
 * `event_type`, `place` y `client_contact` son campos del ticket PIM1-23/89
 * que TODAVÍA NO existen en el modelo Events del backend: se envían en el
 * POST (DRF ignora los campos que no reconoce) y se leen de forma opcional
 * por si el backend ya los soporta en algún ambiente. Cuando backend los
 * agregue formalmente, quitar el `?` y confirmar los nombres finales.
 */
export interface Event {
  eid: number;
  user: number;
  name: string;
  description: string;
  due_date: string;
  status: string;
  // TODO(backend): Events todavía devuelve `progress_percentage`. No se
  // muestra en la UI; se deja tipado por si algún consumidor lo necesita
  // mientras backend no lo elimina del modelo.
  progress_percentage: number;
  created_at: string;
  event_type?: number | null;
  place?: string | null;
  client_contact?: string | null;
  /** Portada personalizada (PIM1-120): "color" (hex en cover_value) o "image" (URL). null/undefined = sin personalizar, usar eventCoverColor. */
  cover_kind?: "color" | "image" | null;
  cover_value?: string | null;
}

/** Payload para crear un evento (POST /eventos/). */
export interface CreateEventPayload {
  name: string;
  description: string;
  due_date: string;
  event_type?: number;
  place?: string;
  client_contact?: string;
}

/** Payload para editar un evento (PATCH /eventos/<eid>/). Parcial: solo los campos modificados. */
export type UpdateEventPayload = Partial<CreateEventPayload>;

/**
 * Tipo de evento. El endpoint GET/POST /tipos-evento/ (PIM1-89) todavía no
 * existe en el backend (hoy responde 404): mientras tanto se usan tipos
 * predefinidos de respaldo con id `default-*` (ver EVENT_TYPE_FALLBACKS en
 * event-form-modal.tsx), que no se envían como `event_type` al crear.
 */
export interface EventType {
  id: number | string;
  name: string;
}

/**
 * Estado de una gestión. El backend admite "postponed" en el modelo, pero
 * este ticket (PIM1-27) solo crea gestiones en "pending" y las lee tal cual
 * vengan; no hay flujo de UI todavía para posponerlas.
 */
export type SubtaskStatus = "pending" | "done" | "postponed";

/**
 * Categoría de una gestión. El endpoint GET/POST /categorias/ (con id) todavía
 * no existe en el backend (hoy responde 404): mientras tanto `category` en
 * Subtask es texto libre y este tipo solo describe el shape que tendría la
 * respuesta cuando el endpoint exista de verdad.
 */
export interface Category {
  id: number | string;
  name: string;
}

/** Gestión (subtarea) tal como la devuelve el backend (GET/POST /eventos/<eid>/subtareas/). */
export interface Subtask {
  subtask_id: number;
  eid: number;
  title: string;
  description: string;
  category: string;
  /** Decimal como string, tal como lo manda DRF (ej. "2.5"). */
  estimated_hours: string;
  /** "YYYY-MM-DD", sin hora. */
  scheduled_date: string;
  status: SubtaskStatus;
  /** Solo presente en GET /api/hoy/ (TodaySubtaskSerializer): nombre del evento dueño, para la vista agregada. */
  event_name?: string;
  // TODO(backend): SubtaskSerializer todavía devuelve `priority`. El frontend
  // ya no la muestra ni la usa (no hay prioridad: la jerarquía la dan las
  // horas estimadas). Quitar esta nota cuando backend elimine el campo.
}

/** Progreso del día (PIM1-55): siempre trae ambas métricas, el toggle de la UI solo decide cuál se pinta. */
export interface DayProgress {
  completadas: number;
  total: number;
  /** Decimales como string, tal como los manda DRF. */
  horas_completadas: string;
  horas_totales: string;
}

/**
 * Respuesta de GET /api/hoy/ (PIM1-51/54/55). `para_hoy.completadas` solo
 * trae gestiones agendadas HOY y completadas — una completada de otra fecha
 * no aparece en ningún grupo de esta respuesta (limitación conocida, ver
 * PIM1-55: backend ya tiene en desarrollo un parámetro para traer todas las
 * completadas sin importar fecha).
 */
export interface TodaySummary {
  fecha: string;
  metrica: "gestiones" | "horas";
  vencidas: Subtask[];
  para_hoy: { pendientes: Subtask[]; completadas: Subtask[] };
  proximas: Subtask[];
  progreso_dia: DayProgress;
  filtros: { event_id: number | null; status: string | null };
}

/** Payload para crear una gestión (POST /eventos/<eid>/subtareas/). */
export interface CreateSubtaskPayload {
  title: string;
  description: string;
  category: string;
  estimated_hours: string;
  scheduled_date: string;
  status: SubtaskStatus;
}

/** Payload para editar una gestión (PATCH /subtareas/<subtask_id>/). Parcial: solo los campos modificados. */
export type UpdateSubtaskPayload = Partial<CreateSubtaskPayload>;
