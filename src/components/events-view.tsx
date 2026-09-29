// Vista "Eventos" (HU-13/PIM1-111): roulette de scroll horizontal con una
// card por evento (más la card especial "Crear nuevo evento" siempre
// presente, primera en la fila). Clickear una card muestra la vista
// expandida del evento (EventDetailView) en el lugar del roulette, con info
// del evento, sus gestiones en 4 tablas (Para hoy/Vencidas/Próximas/
// Completadas), y cada fila abre el mismo SubtaskDetailModal/SubtaskFormModal
// globales que ya usa la vista Hoy (onOpenSubtask, ver homepage.tsx). "Volver
// a Eventos" regresa.

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { todayLocalDateString } from "../lib/dates";
import { sortSubtasksByDateThenHours } from "../lib/subtask-display";
import type { Event, EventType, Subtask } from "../lib/types";
import { EventCard } from "./event-card";
import { CreateEventCard } from "./create-event-card";
import { EventDetailView } from "./event-detail-view";

const PREVIEW_LIMIT = 3;

interface EventProgress {
  completed: number;
  total: number;
  today: number;
  preview: Subtask[];
  previewMoreCount: number;
  /** Lista completa (sin recortar) para las 4 tablas de la vista expandida. */
  all: Subtask[];
}

interface EventsViewProps {
  events: Event[];
  status: "loading" | "ready" | "error";
  errorMessage: string;
  onRetry: () => void;
  onCreateEvent: () => void;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
  /** Abre el detalle de una gestión (mismo SubtaskDetailModal global que ya usa la vista Hoy). */
  onOpenSubtask: (subtask: Subtask) => void;
  /**
   * Se incrementa desde homepage.tsx cada vez que una gestión se crea, edita,
   * borra o completa/despausa (desde cualquier pestaña). progressByEvent es un
   * fetch propio de esta vista, así que sin esto las 4 tablas de la vista
   * expandida quedaban desactualizadas hasta recargar la página.
   */
  refreshToken: number;
}

export function EventsView({
  events,
  status,
  errorMessage,
  onRetry,
  onCreateEvent,
  onEditEvent,
  onDeleteEvent,
  onOpenSubtask,
  refreshToken,
}: EventsViewProps) {
  const [progressByEvent, setProgressByEvent] = useState<Record<number, EventProgress>>({});
  const [eventTypeNames, setEventTypeNames] = useState<Record<number, string>>({});
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<EventType[]>("/tipos-evento/")
      .then((data) => {
        if (cancelled) return;
        const byId: Record<number, string> = {};
        for (const type of data) {
          if (typeof type.id === "number") byId[type.id] = type.name;
        }
        setEventTypeNames(byId);
      })
      .catch(() => {
        // Sin endpoint (404) o sin conexión: las cards simplemente no
        // muestran el chip de tipo, no es un dato crítico para esta vista.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "ready" || events.length === 0) return;
    let cancelled = false;
    const today = todayLocalDateString();

    // Un GET por evento: no hay (todavía) un endpoint agregado de progreso
    // por evento (ver progreso_evento() planeado en TS-07 para cuando entre
    // US-10). Para el número de eventos de un proyecto académico esto es
    // aceptable; si la lista crece mucho conviene revisarlo.
    Promise.all(
      events.map(async (event) => {
        try {
          const subtasks = await apiFetch<Subtask[]>(`/eventos/${event.eid}/subtareas/`);
          const completed = subtasks.filter((subtask) => subtask.status === "done").length;
          const todayCount = subtasks.filter(
            (subtask) => subtask.status !== "done" && subtask.scheduled_date === today
          ).length;
          const pending = sortSubtasksByDateThenHours(subtasks.filter((subtask) => subtask.status !== "done"));
          return [
            event.eid,
            {
              completed,
              total: subtasks.length,
              today: todayCount,
              preview: pending.slice(0, PREVIEW_LIMIT),
              previewMoreCount: Math.max(0, pending.length - PREVIEW_LIMIT),
              all: subtasks,
            },
          ] as const;
        } catch {
          // Progreso no disponible para este evento puntual: se muestra como
          // "sin gestiones" en vez de tumbar toda la vista por un solo fetch fallido.
          return [
            event.eid,
            { completed: 0, total: 0, today: 0, preview: [], previewMoreCount: 0, all: [] },
          ] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setProgressByEvent(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [status, events, refreshToken]);

  if (status === "loading") {
    return <p className="subtasks-status">Cargando eventos…</p>;
  }

  if (status === "error") {
    return (
      <div className="subtasks-status subtasks-status--error" role="alert">
        <p>{errorMessage}</p>
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      </div>
    );
  }

  function eventTypeNameFor(event: Event): string | undefined {
    return event.event_type != null ? eventTypeNames[event.event_type] : undefined;
  }

  const expandedEvent = expandedEventId != null ? (events.find((event) => event.eid === expandedEventId) ?? null) : null;

  if (expandedEvent) {
    const expandedProgress = progressByEvent[expandedEvent.eid];
    return (
      <EventDetailView
        event={expandedEvent}
        eventTypeName={eventTypeNameFor(expandedEvent)}
        subtasks={expandedProgress?.all ?? []}
        subtasksLoading={!expandedProgress}
        onBack={() => setExpandedEventId(null)}
        onEdit={() => onEditEvent(expandedEvent)}
        onDelete={() => onDeleteEvent(expandedEvent)}
        onOpenSubtask={onOpenSubtask}
      />
    );
  }

  if (events.length === 0) {
    // Corrección del profesor (clínica de Sprint 1): sin eventos, ocultar
    // todo y dejar solo el mensaje + un único botón de crear.
    return (
      <div className="grid flex-1 min-h-[420px] place-items-center px-8">
        <div className="grid justify-items-center gap-5 text-center">
          <p className="m-0 text-[28px] leading-[1.16] text-[#99a1af]">
            Aún no tienes eventos
            <br />
            ¡Crea uno nuevo!
          </p>
          <CreateEventCard onClick={onCreateEvent} />
        </div>
      </div>
    );
  }

  return (
    // "safe center": centra las cards cuando entran todas en pantalla, pero si
    // desbordan se comporta como flex-start (sin "safe" un desborde con center
    // puede dejar el principio de la fila inaccesible al hacer scroll,
    // incluida la card de "Crear nuevo evento"). Va como `style` y no como
    // clase de Tailwind: `justify-[safe_center]` no compila a nada en
    // Tailwind v4 (verificado contra el CSS servido) y el div se queda sin
    // centrar en absoluto.
    // min-h + items-center: sin altura mínima el contenedor solo mide lo que
    // ocupan las cards y quedan pegadas arriba (mismo criterio que el
    // min-h-[420px] del estado vacío, para que no salte al cambiar de estado).
    // flex-1: min-h por sí solo solo centra dentro de su propia caja de
    // 420px, que quedaba pegada arriba de la página si la pantalla tiene más
    // alto disponible que eso. flex-1 (no h-full: eventos-panel no tiene un
    // `height` explícito, es flex-grow, así que un % no resuelve — verificado
    // con Claude in Chrome) toma el alto real que le da eventos-panel
    // (flex flex-col flex-1 sobre planner-shell, ver homepage.tsx/css), así
    // que el centrado es contra el alto real de la pantalla, no solo 420px.
    <div
      className="flex flex-1 min-h-[420px] items-center gap-4 overflow-x-auto px-8 pb-8"
      style={{ justifyContent: "safe center" }}
    >
      <CreateEventCard onClick={onCreateEvent} />
      {events.map((event) => {
        const progress = progressByEvent[event.eid];
        return (
          <EventCard
            key={event.eid}
            event={event}
            eventTypeName={eventTypeNameFor(event)}
            completed={progress?.completed ?? 0}
            total={progress?.total ?? 0}
            todayCount={progress?.today ?? 0}
            previewSubtasks={progress?.preview ?? []}
            previewMoreCount={progress?.previewMoreCount ?? 0}
            loading={!progress}
            onOpen={() => setExpandedEventId(event.eid)}
          />
        );
      })}
    </div>
  );
}
