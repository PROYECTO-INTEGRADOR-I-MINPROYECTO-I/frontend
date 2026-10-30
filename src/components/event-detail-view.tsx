// Vista expandida de un evento (HU-13/PIM1-111): información del evento +
// editar/borrar, y las 4 tablas de gestiones (Para hoy/Vencidas/Próximas/
// Completadas), expandidas por defecto, con contador "- X GESTIONES", una
// flecha que indica expandido/colapsado (el <details>/<summary> nativo pierde
// su marcador con `display: flex`, así que sin esto no había ninguna pista
// visual de que la tabla es desplegable) y columnas Nombre/Tipo/Fecha/
// Descripción/Estado — ver Correcciones de UI...txt. Cada tabla tiene su
// propio filtro por tipo (categoría), también pedido en las correcciones —
// siempre visible (incluso con una sola categoría) para que el filtro sea
// descubrible sin depender de cuántos tipos de gestión tenga el evento.
// Clickear una fila abre el mismo SubtaskDetailModal global que ya usa la
// vista Hoy (onOpenSubtask, ver homepage.tsx/events-view.tsx).

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { EventCover } from "./event-cover";
import { EventProgressBar } from "./event-progress-bar";
import { GestionTable } from "./gestion-table";
import { formatShortDateEs, isoDateTimeToLocalDateString, todayLocalDateString } from "../lib/dates";
import {
  sortCompletedSubtasksByDateDesc,
  sortSubtasksByDateThenHours,
  subtaskTimeStatus,
  TIME_STATUS_STYLES,
  type SubtaskTimeStatus,
} from "../lib/subtask-display";
import type { Event, Subtask } from "../lib/types";

interface CommonProps {
  eventTypeName?: string;
  subtasks: Subtask[];
  subtasksLoading: boolean;
  onBack: () => void;
  onOpenSubtask: (subtask: Subtask) => void;
  /** Hash de la URL (ej. "#pospuestas"): al terminar de cargar, lleva a ese grupo. */
  scrollHash?: string;
}

interface SingleEventProps extends CommonProps {
  event: Event;
  onEdit: () => void;
  onDelete: () => void;
  /** Ver EventCover: el PATCH de portada devuelve el evento completo para que el padre actualice su lista. */
  onEventCoverUpdated: (event: Event) => void;
  /** Abre el wizard de creación de gestión (ver SubtaskWizard) para este evento. */
  onCreateSubtask: () => void;
  eventNameById?: undefined;
  incompleteWarning?: undefined;
}

// Sin `event`: vista global con las gestiones de todos los eventos.
interface AllEventsProps extends CommonProps {
  event?: undefined;
  /** Nombres por eid para la columna Evento. */
  eventNameById: Record<number, string>;
  /** Algún evento no pudo cargar sus gestiones: el progreso puede estar incompleto. */
  incompleteWarning?: boolean;
  onEdit?: undefined;
  onDelete?: undefined;
  onEventCoverUpdated?: undefined;
  onCreateSubtask?: undefined;
}

type EventDetailViewProps = SingleEventProps | AllEventsProps;

export function EventDetailView(props: EventDetailViewProps) {
  const { eventTypeName, subtasks, subtasksLoading, onBack, onOpenSubtask, scrollHash, eventNameById } = props;
  const dateLabel = props.event ? formatShortDateEs(isoDateTimeToLocalDateString(props.event.due_date)) : "";
  const today = todayLocalDateString();

  useEffect(() => {
    if (subtasksLoading) return;
    const group = scrollHash === "#pospuestas" ? document.getElementById("pospuestas") : null;
    if (group instanceof HTMLDetailsElement) {
      group.open = true;
      group.scrollIntoView?.();
    } else {
      window.scrollTo?.(0, 0);
    }
  }, [subtasksLoading, scrollHash]);

  const vencidas = sortSubtasksByDateThenHours(
    subtasks.filter((subtask) => subtaskTimeStatus(subtask.status, subtask.scheduled_date, today) === "overdue")
  );
  const paraHoy = sortSubtasksByDateThenHours(
    subtasks.filter((subtask) => subtaskTimeStatus(subtask.status, subtask.scheduled_date, today) === "today")
  );
  const proximas = sortSubtasksByDateThenHours(
    subtasks.filter((subtask) => subtaskTimeStatus(subtask.status, subtask.scheduled_date, today) === "upcoming")
  );
  const completadas = sortCompletedSubtasksByDateDesc(
    subtasks.filter((subtask) => subtaskTimeStatus(subtask.status, subtask.scheduled_date, today) === "done")
  );
  const pospuestas = sortSubtasksByDateThenHours(
    subtasks.filter((subtask) => subtaskTimeStatus(subtask.status, subtask.scheduled_date, today) === "postponed")
  );

  return (
    <div className="px-8 pb-8">
      <div className={`mx-auto ${props.event ? "max-w-2xl" : "max-w-5xl"}`}>
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 font-jost text-[13px] text-[#4a5565] hover:text-[#101828]"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Volver a Eventos
        </button>

        <div className="overflow-hidden rounded-lg border border-[#f3f4f6] bg-white">
          {props.event && (
            <EventCover
              event={props.event}
              eventTypeName={eventTypeName}
              onEventCoverUpdated={props.onEventCoverUpdated}
              className="aspect-video w-full"
            />
          )}

          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-2">
              <h1 className="font-jost text-[24px] leading-[30px] text-[#101828]">
                {props.event ? props.event.name : "Progreso de todos los eventos"}
              </h1>
              {props.event && (
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={props.onEdit}
                    className="inline-flex items-center gap-1 font-jost text-[13px] text-[#4a5565] hover:text-[#101828]"
                  >
                    <Pencil aria-hidden="true" size={14} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={props.onDelete}
                    className="inline-flex items-center gap-1 font-jost text-[13px] text-[#8b1a1a] hover:text-[#6f1515]"
                  >
                    <Trash2 aria-hidden="true" size={14} />
                    Borrar
                  </button>
                </div>
              )}
            </div>

            {props.event && (
              <div className="flex flex-wrap items-center gap-2">
                {eventTypeName && (
                  <span className="shrink-0 rounded px-[6px] py-0.5 font-jost text-[10px] text-[#4a5565] bg-[#f3f4f6]">
                    {eventTypeName}
                  </span>
                )}
                <span className="font-source text-[13px] text-[#636b78]">{dateLabel}</span>
              </div>
            )}

            {props.event?.place && (
              <p className="font-source text-[14px] text-[#4a5565]">
                <span className="font-jost text-[11px] tracking-[0.5px] text-[#636b78] uppercase">Lugar: </span>
                {props.event.place}
              </p>
            )}

            {props.event?.client_contact && (
              <p className="font-source text-[14px] text-[#4a5565]">
                <span className="font-jost text-[11px] tracking-[0.5px] text-[#636b78] uppercase">Contacto: </span>
                {props.event.client_contact}
              </p>
            )}

            {props.event?.description && (
              <p className="font-source text-[14px] leading-[22.75px] text-[#4a5565]">{props.event.description}</p>
            )}

            {!subtasksLoading && (
              <EventProgressBar
                subtasks={subtasks}
                label={props.event ? "Progreso del evento" : "Progreso de todos los eventos"}
              />
            )}
            {!subtasksLoading && props.incompleteWarning && (
              <p role="alert" className="font-source text-[12px] text-[#8b1a1a]">
                No se pudieron cargar las gestiones de algunos eventos; el progreso puede estar incompleto.
              </p>
            )}
          </div>
        </div>

        {props.event && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={props.onCreateSubtask}
              className="inline-flex h-[34px] items-center justify-center gap-1.5 rounded-full bg-[#8b1a1a] px-4 font-jost text-[14px] text-white"
            >
              Crear gestión <Plus aria-hidden="true" size={16} />
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {subtasksLoading ? (
            <p className="font-source text-[13px] text-[#636b78]">Cargando gestiones…</p>
          ) : (
            <>
              <GestionGroup status="today" label="Para hoy" items={paraHoy} emptyHint="Sin gestiones para hoy." onOpenSubtask={onOpenSubtask} eventNameById={eventNameById} />
              <GestionGroup status="overdue" label="Vencidas" items={vencidas} emptyHint="Sin gestiones vencidas." onOpenSubtask={onOpenSubtask} eventNameById={eventNameById} />
              <GestionGroup status="upcoming" label="Próximas" items={proximas} emptyHint="Sin gestiones próximas." onOpenSubtask={onOpenSubtask} eventNameById={eventNameById} />
              <GestionGroup
                status="done"
                label="Completadas"
                items={completadas}
                emptyHint="Sin gestiones completadas."
                onOpenSubtask={onOpenSubtask}
                eventNameById={eventNameById}
              />
              <GestionGroup
                id="pospuestas"
                status="postponed"
                label="Pospuestas"
                items={pospuestas}
                emptyHint="Sin gestiones pospuestas."
                onOpenSubtask={onOpenSubtask}
                eventNameById={eventNameById}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface GestionGroupProps {
  id?: string;
  status: SubtaskTimeStatus;
  label: string;
  items: Subtask[];
  emptyHint: string;
  onOpenSubtask: (subtask: Subtask) => void;
  eventNameById?: Record<number, string>;
}

function GestionGroup({ id, status, label, items, emptyHint, onOpenSubtask, eventNameById }: GestionGroupProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Se calculan sobre `items` (sin filtrar) para que las opciones del select
  // no desaparezcan al elegir una: las categorías disponibles son las que
  // tiene el grupo completo, no las del subconjunto ya filtrado.
  const categories = Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b));
  // Si `items` cambia (ej. refetch tras editar/completar una gestión en otra
  // pestaña) y la categoría elegida ya no existe en el grupo, no nos quedamos
  // mostrando "sin resultados" sin forma de volver: se vuelve a "Todos" sola.
  const effectiveFilter = categories.includes(categoryFilter) ? categoryFilter : "all";
  const visibleItems = effectiveFilter === "all" ? items : items.filter((item) => item.category === effectiveFilter);
  const filterId = `gestion-filter-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <details
      id={id}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      style={{ backgroundColor: TIME_STATUS_STYLES[status].bg }}
      className="rounded-lg border border-black/10"
    >
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-jost text-[13px] tracking-[0.5px] text-[#101828] uppercase">
        <span className="flex items-center gap-2">
          {label}
          <ChevronDown
            aria-hidden="true"
            size={16}
            className={`text-[#636b78] transition-transform duration-150 ${isOpen ? "" : "rotate-180"}`}
          />
        </span>
        <span className="font-source text-[11px] normal-case text-[#636b78]">- {visibleItems.length} GESTIONES</span>
      </summary>
      <div className="border-t border-black/10 px-4 py-3">
        {items.length === 0 ? (
          <p className="font-source text-[13px] text-[#636b78]">{emptyHint}</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <label htmlFor={filterId} className="font-jost text-[12px] tracking-[0.5px] text-[#4a5565] uppercase">
                Tipo
              </label>
              <select
                id={filterId}
                value={effectiveFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded border border-[#e5e7eb] bg-white px-2 py-1 font-source text-[13px] text-[#1e2939]"
              >
                <option value="all">Todos</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <GestionTable items={visibleItems} onOpenSubtask={onOpenSubtask} eventNameById={eventNameById} />
          </>
        )}
      </div>
    </details>
  );
}
