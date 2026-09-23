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
  progress_percentage: number;
  created_at: string;
  event_type?: number | null;
  place?: string | null;
  client_contact?: string | null;
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
