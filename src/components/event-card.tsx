// Card de evento para la vista "Eventos" (HU-13/PIM1-111, ver "Correcciones
// de UI dadas por el profesor durante clinica de sprint 1.txt"): portada
// 16:9 (EventCover, personalizable al pasar el mouse), título, tipo + fecha,
// barra de progreso, contador de completadas y una mini-lista de las
// próximas gestiones. Pensada para vivir en un roulette de scroll horizontal
// (ver EventsView), por eso el aspecto vertical y el ancho fijo en vez de
// estirarse a lo ancho del contenedor.
//
// La card entera es clickeable (abre el evento), pero EventCover necesita un
// botón real anidado para personalizar la portada; un <button> no puede
// contener otro <button> (HTML inválido), así que la raíz es un
// div role="button" en vez de un <button> — mismo patrón de tabIndex +
// onClick + onKeyDown que las filas de gestión en event-detail-view.tsx.

import { EventCover } from "./event-cover";
import { formatShortDateEs, isoDateTimeToLocalDateString } from "../lib/dates";
import type { Event, Subtask } from "../lib/types";

interface EventCardProps {
  event: Event;
  eventTypeName?: string;
  /** Gestiones completadas / total del evento. Ambas en 0 mientras carga o si el evento aún no tiene gestiones. */
  completed: number;
  total: number;
  /** Gestiones pendientes programadas para hoy (0 no se muestra). */
  todayCount: number;
  /** Hasta 3 gestiones pendientes (las más próximas) para el resumen. */
  previewSubtasks: Subtask[];
  /** Gestiones pendientes que no entraron en el resumen. */
  previewMoreCount: number;
  /** Progreso todavía no cargado (fetch en curso): oculta barra y resumen para no mostrar datos a medias. */
  loading?: boolean;
  onOpen: () => void;
}

export function EventCard({
  event,
  eventTypeName,
  completed,
  total,
  todayCount,
  previewSubtasks,
  previewMoreCount,
  loading = false,
  onOpen,
}: EventCardProps) {
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const dateLabel = formatShortDateEs(isoDateTimeToLocalDateString(event.due_date));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Enter" || keyEvent.key === " ") {
          keyEvent.preventDefault();
          onOpen();
        }
      }}
      className="flex w-60 shrink-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-[#f3f4f6] bg-white text-left transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
    >
      <EventCover event={event} className="aspect-video w-full" />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-jost text-[16px] leading-[20px] text-[#101828]">{event.name}</p>

        <div className="flex flex-wrap items-center gap-2">
          {eventTypeName && (
            <span className="shrink-0 rounded px-[6px] py-0.5 font-jost text-[10px] text-[#4a5565] bg-[#f3f4f6]">
              {eventTypeName}
            </span>
          )}
          <span className="font-source text-[12px] text-[#99a1af]">{dateLabel}</span>
        </div>

        {loading ? (
          <p className="font-source text-[12px] text-[#99a1af]">Cargando progreso…</p>
        ) : total === 0 ? (
          <p className="font-source text-[12px] text-[#99a1af]">Sin gestiones todavía.</p>
        ) : (
          <>
            <div
              role="progressbar"
              aria-label={`Progreso de ${event.name}`}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full bg-[#f3f4f6]"
            >
              <div className="h-full rounded-full bg-[#8b1a1a]" style={{ width: `${progress}%` }} />
            </div>
            <p className="font-source text-[12px] text-[#4a5565]">
              {completed} de {total} gestiones completadas
            </p>
            {todayCount > 0 && (
              <p className="font-source text-[12px] text-[#bb4d00]">
                {todayCount} {todayCount === 1 ? "gestión" : "gestiones"} para hoy
              </p>
            )}

            {previewSubtasks.length > 0 && (
              <div className="mt-1 flex flex-col gap-1 border-t border-[#f3f4f6] pt-2">
                {previewSubtasks.map((subtask) => (
                  <p key={subtask.subtask_id} className="truncate font-source text-[12px] text-[#4a5565]">
                    {subtask.title}
                  </p>
                ))}
                {previewMoreCount > 0 && (
                  <p className="font-source text-[11px] text-[#99a1af]">+{previewMoreCount} más</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
