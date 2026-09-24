// Datos semilla del modo mock. Las fechas se calculan relativas a HOY cada
// vez que se genera la base (arranque sin datos guardados o `?mock-reset`),
// para que siempre haya gestiones vencidas, de hoy y próximas sin importar
// cuándo se corra `npm run dev:mock`.

import { toLocalDateString } from "../lib/dates";
import type { Category, Event, EventType, Subtask } from "../lib/types";

export interface MockDb {
  events: Event[];
  subtasks: Subtask[];
  eventTypes: EventType[];
  categories: Category[];
  nextEventId: number;
  nextSubtaskId: number;
  nextEventTypeId: number;
}

function addDays(base: Date, days: number): Date {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

function isoAt(base: Date, days: number, hours: number, minutes: number): string {
  const date = addDays(base, days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function localDate(base: Date, days: number): string {
  return toLocalDateString(addDays(base, days));
}

// Mismas 5 opciones predefinidas que EVENT_TYPE_FALLBACKS en
// event-form-modal.tsx, pero con id numérico real: acá el GET /tipos-evento/
// sí "existe", así que el frontend usa esta lista en vez del respaldo.
const PREDEFINED_EVENT_TYPES: EventType[] = [
  { id: 1, name: "Boda" },
  { id: 2, name: "Social" },
  { id: 3, name: "Corporativo" },
  { id: 4, name: "Cumpleaños" },
  { id: 5, name: "Otro" },
];

// Mismas 7 categorías predefinidas que CATEGORY_FALLBACKS en
// subtask-form-modal.tsx: id igual al nombre, porque `category` en Subtask es
// texto libre y así el formulario envía directamente el nombre elegido.
const PREDEFINED_CATEGORIES: Category[] = [
  "Lugar",
  "Catering",
  "Invitaciones",
  "Proveedores",
  "Logística técnica",
  "Personal/Conferencistas",
  "Marketing",
].map((name) => ({ id: name, name }));

export function createSeedData(): MockDb {
  const now = new Date();
  const nowIso = now.toISOString();

  const events: Event[] = [
    {
      eid: 1,
      user: 1,
      name: "Boda Luisa & Carlos",
      description: "Ceremonia y recepción en el jardín principal.",
      due_date: isoAt(now, 14, 16, 0),
      status: "pending",
      progress_percentage: 25,
      created_at: nowIso,
      event_type: 1,
      place: "Jardines El Retiro",
      client_contact: "Luisa Gómez — 300 555 1212",
    },
    {
      eid: 2,
      user: 1,
      name: "Cumpleaños Antonio",
      description: "Fiesta sorpresa de cumpleaños número 50.",
      due_date: isoAt(now, 5, 19, 0),
      status: "pending",
      progress_percentage: 40,
      created_at: nowIso,
      event_type: 4,
      place: "Salón Los Nogales",
      client_contact: "Marta Ríos — 310 555 4545",
    },
    {
      eid: 3,
      user: 1,
      name: "Conferencia Anual TechCorp",
      description: "Encuentro anual de tecnología con ponentes invitados.",
      due_date: isoAt(now, 30, 9, 0),
      status: "pending",
      progress_percentage: 10,
      created_at: nowIso,
      event_type: 3,
      place: "Centro de Convenciones Ágora",
      client_contact: "Diego Salas — 320 555 9090",
    },
  ];

  const subtasks: Subtask[] = [
    {
      subtask_id: 1,
      eid: 1,
      title: "Confirmar catering",
      description: "Cerrar el menú definitivo con el proveedor.",
      category: "Catering",
      estimated_hours: "2",
      scheduled_date: localDate(now, 0),
      status: "pending",
    },
    {
      subtask_id: 2,
      eid: 1,
      title: "Reservar salón",
      description: "Firmar el contrato de alquiler del jardín.",
      category: "Lugar",
      estimated_hours: "1",
      scheduled_date: localDate(now, 0),
      status: "done",
    },
    {
      subtask_id: 3,
      eid: 1,
      title: "Enviar invitaciones",
      description: "Enviar invitaciones físicas y digitales a los asistentes.",
      category: "Invitaciones",
      estimated_hours: "3",
      scheduled_date: localDate(now, 3),
      status: "pending",
    },
    {
      subtask_id: 4,
      eid: 1,
      title: "Contratar fotógrafo",
      description: "Elegir y contratar al fotógrafo del evento.",
      category: "Proveedores",
      estimated_hours: "1.5",
      scheduled_date: localDate(now, -2),
      status: "pending",
    },
    {
      subtask_id: 5,
      eid: 2,
      title: "Comprar decoración",
      description: "Globos, luces y mantelería temática.",
      category: "Logística técnica",
      estimated_hours: "2",
      scheduled_date: localDate(now, 0),
      status: "pending",
    },
    {
      subtask_id: 6,
      eid: 2,
      title: "Reservar animador",
      description: "Confirmar disponibilidad del animador para la fiesta.",
      category: "Personal/Conferencistas",
      estimated_hours: "1",
      scheduled_date: localDate(now, 1),
      status: "pending",
    },
    {
      subtask_id: 7,
      eid: 2,
      title: "Encargar pastel",
      description: "Pastel de tres pisos, sabor chocolate.",
      category: "Catering",
      estimated_hours: "1",
      scheduled_date: localDate(now, 0),
      status: "done",
    },
    {
      subtask_id: 8,
      eid: 3,
      title: "Confirmar ponentes",
      description: "Cerrar la lista final de conferencistas invitados.",
      category: "Personal/Conferencistas",
      estimated_hours: "4",
      scheduled_date: localDate(now, -1),
      status: "pending",
    },
    {
      subtask_id: 9,
      eid: 3,
      title: "Publicar agenda",
      description: "Publicar la agenda del evento en el sitio web.",
      category: "Marketing",
      estimated_hours: "2.5",
      scheduled_date: localDate(now, 7),
      status: "pending",
    },
  ];

  return {
    events,
    subtasks,
    eventTypes: [...PREDEFINED_EVENT_TYPES],
    categories: [...PREDEFINED_CATEGORIES],
    nextEventId: events.length + 1,
    nextSubtaskId: subtasks.length + 1,
    nextEventTypeId: PREDEFINED_EVENT_TYPES.length + 1,
  };
}
