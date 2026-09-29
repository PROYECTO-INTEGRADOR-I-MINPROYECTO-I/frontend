// Vista "Eventos" (HU-13/PIM1-111): roulette de scroll horizontal con una
// card por evento (más la card especial "Crear nuevo evento" siempre
// presente, primera en la fila). Primer corte — el click en una card
// todavía no abre el detalle expandido (tablas Para hoy/Vencidas/
// Próximas/Completadas) que pide la corrección del profesor, eso queda para
// una siguiente rama. Por ahora, clickear una card selecciona ese evento y
// lleva a la vista "Hoy" filtrada por él (comportamiento real ya existente,
// no un placeholder muerto).

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { todayLocalDateString } from "../lib/dates";
import { sortSubtasksByDateThenHours } from "../lib/subtask-display";
import type { Event, EventType, Subtask } from "../lib/types";
import { EventCard } from "./event-card";
import { CreateEventCard } from "./create-event-card";

const PREVIEW_LIMIT = 3;

interface EventProgress {
  completed: number;
  total: number;
  today: number;
  preview: Subtask[];
  previewMoreCount: number;
}

interface EventsViewProps {
  events: Event[];
  status: "loading" | "ready" | "error";
  errorMessage: string;
  onRetry: () => void;
  onCreateEvent: () => void;
  onOpenEvent: (event: Event) => void;
}

export function EventsView({ events, status, errorMessage, onRetry, onCreateEvent, onOpenEvent }: EventsViewProps) {
  const [progressByEvent, setProgressByEvent] = useState<Record<number, EventProgress>>({});
  const [eventTypeNames, setEventTypeNames] = useState<Record<number, string>>({});

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
            },
          ] as const;
        } catch {
          // Progreso no disponible para este evento puntual: se muestra como
          // "sin gestiones" en vez de tumbar toda la vista por un solo fetch fallido.
          return [event.eid, { completed: 0, total: 0, today: 0, preview: [], previewMoreCount: 0 }] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setProgressByEvent(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [status, events]);

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

  if (events.length === 0) {
    // Corrección del profesor (clínica de Sprint 1): sin eventos, ocultar
    // todo y dejar solo el mensaje + un único botón de crear.
    return (
      <div className="grid min-h-[420px] place-items-center px-8">
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
    // justify-[safe_center]: centra las cards cuando entran todas en pantalla,
    // pero si desbordan se comporta como justify-start (sin el "safe" un
    // desborde con justify-center puede dejar el principio de la fila
    // inaccesible al hacer scroll, incluida la card de "Crear nuevo evento").
    <div className="flex justify-[safe_center] gap-4 overflow-x-auto px-8 pb-8">
      <CreateEventCard onClick={onCreateEvent} />
      {events.map((event) => {
        const progress = progressByEvent[event.eid];
        return (
          <EventCard
            key={event.eid}
            event={event}
            eventTypeName={event.event_type != null ? eventTypeNames[event.event_type] : undefined}
            completed={progress?.completed ?? 0}
            total={progress?.total ?? 0}
            todayCount={progress?.today ?? 0}
            previewSubtasks={progress?.preview ?? []}
            previewMoreCount={progress?.previewMoreCount ?? 0}
            loading={!progress}
            onOpen={() => onOpenEvent(event)}
          />
        );
      })}
    </div>
  );
}
