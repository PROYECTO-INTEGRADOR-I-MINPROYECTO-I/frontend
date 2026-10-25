// Tarjeta de gestión (PIM1-27, ver hoy-seleccion-evento.tsx en el Figma para
// las medidas/colores exactos). Toda la tarjeta es accesible como botón que
// abre el detalle: el aria-label lleva el título para que quede claro aunque
// el resto sean chips y badges sin texto asociado a un label.
//
// NOTA: la tarjeta ya no es un <button> nativo (era así antes de US-09).
// Ahora incluye un checkbox de "completar" propio (otro control interactivo),
// y HTML no permite anidar <button> dentro de <button>. Por eso el
// contenedor pasa a ser un <div role="button" tabIndex={0}> con su propio
// manejo de teclado (Enter/Espacio), que conserva el mismo comportamiento
// accesible que tenía el <button> original.

import { Check, CheckSquare, Clock, Play, StickyNote } from "lucide-react";
import type { Subtask } from "../lib/types";
import { categoryChipStyle, formatDuration } from "../lib/subtask-display";
import { formatShortDateEs } from "../lib/dates";
import { cn } from "../lib/utils";

export const DRAG_TYPE = "application/x-subtask";

interface SubtaskCardProps {
  subtask: Subtask;
  onOpen: (subtask: Subtask) => void;
  /** Vencida (columna Vencidas): borde tenue en vino y aviso "Requiere acción". */
  overdue?: boolean;
  /** Completada (subsección de Para hoy): tarjeta atenuada con la marca "Completada". */
  completed?: boolean;
  /** Marca/desmarca la gestión como completada (US-09). Sin esta prop no se pinta el checkbox. */
  onToggleComplete?: (subtask: Subtask) => void;
  /** Deshabilita el checkbox mientras el cambio está en curso, para evitar dobles clics. */
  pending?: boolean;
  /** Pospuesta: tarjeta atenuada y el botón pasa a "Reactivar". */
  postponed?: boolean;
  onPostpone?: (subtask: Subtask) => void;
  onReactivate?: (subtask: Subtask) => void;
  onAddNote?: (subtask: Subtask) => void;
  /**
   * PIM1-11 (corrección del profesor): nombre del evento al que pertenece la
   * gestión, para distinguirla cuando la vista no está filtrada por un solo
   * evento. Hoy siempre se pasa `selectedEvent.name` (mismo valor en todas
   * las tarjetas); cuando exista el agregado real de /hoy, cada gestión
   * traerá su propio evento y este prop pasará a variar por card.
   */
  eventName?: string;
  /**
   * Click en el nombre del evento (botón real, no solo texto). Sin destino
   * todavía — HU-13 (/evento/:id) no existe — así que por ahora queda sin
   * pasar en homepage.tsx: el botón existe y es accesible, pero no navega a
   * nada hasta que se conecte esta prop.
   */
  onEventClick?: () => void;
  /** Permite arrastrar la tarjeta a otro grupo (se bloquea mientras `pending`). */
  draggable?: boolean;
}

export function SubtaskCard({
  subtask,
  onOpen,
  overdue = false,
  completed = false,
  onToggleComplete,
  pending = false,
  postponed = false,
  onPostpone,
  onReactivate,
  onAddNote,
  eventName,
  onEventClick,
  draggable = false,
}: SubtaskCardProps) {
  const categoryStyle = categoryChipStyle(subtask.category);
  const hoursLabel = formatDuration(subtask.estimated_hours);
  const isDone = subtask.status === "done";
  const canDrag = draggable && !pending;
  const action = postponed ? onReactivate : onPostpone;

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    // El keydown de un control anidado (el checkbox) también burbujea hasta
    // acá: si no se filtra por target, Enter/Espacio sobre el checkbox
    // abriría el detalle además de alternar el estado. Solo procesa el
    // evento si se originó en el propio contenedor.
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(subtask);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(subtask)}
      onKeyDown={handleKeyDown}
      draggable={canDrag || undefined}
      onDragStart={
        canDrag
          ? (e) => {
              e.dataTransfer.setData(DRAG_TYPE, String(subtask.subtask_id));
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      aria-label={subtask.title}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border bg-white p-4 text-left transition-colors hover:border-[#d4d5d7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
        overdue ? "border-[rgba(139,26,26,0.1)]" : "border-[#f3f4f6]",
        (completed || postponed) && "opacity-60",
        canDrag && "cursor-grab"
      )}
    >
      {onToggleComplete && (
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={`Marcar ${subtask.title} como completada`}
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation();
            onToggleComplete(subtask);
          }}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50",
            isDone ? "border-[#007a55] bg-[#007a55] text-white" : "border-[#d4d5d7] text-transparent"
          )}
        >
          <Check aria-hidden="true" size={12} />
        </button>
      )}

      <div className="flex w-full flex-col">
        <div className="flex w-full items-start justify-between gap-2">
          <p className="font-jost text-[14px] leading-[17.5px] text-[#101828]">{subtask.title}</p>
          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 font-jost text-[10px] tracking-[0.25px] text-[#4a5565] uppercase">
              {hoursLabel}
            </span>
            {postponed && onAddNote && (
              <button
                type="button"
                aria-label="Añadir nota"
                title="Añadir nota"
                onClick={(event) => {
                  event.stopPropagation();
                  onAddNote(subtask);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#99a1af] transition-colors hover:bg-[#f4f4f5] hover:text-[#52525b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
              >
                <StickyNote aria-hidden="true" size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex w-full items-center gap-3 pt-2">
          <span
            className="shrink-0 rounded px-[6px] py-0.5 font-jost text-[10px]"
            style={{ backgroundColor: categoryStyle.bg, color: categoryStyle.text }}
          >
            {subtask.category}
          </span>
          <span className={cn("font-source text-[12px]", overdue ? "text-[rgba(139,26,26,0.7)]" : "text-[#99a1af]")}>
            {formatShortDateEs(subtask.scheduled_date)}
          </span>
          {action && !isDone && (
            <button
              type="button"
              disabled={pending}
              onClick={(event) => {
                event.stopPropagation();
                action(subtask);
              }}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-[#8b1a1a] px-2 py-0.5 font-jost text-[12px] text-[#8b1a1a] transition-colors hover:bg-[#fff0f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a] disabled:opacity-50"
            >
              {postponed ? <Play aria-hidden="true" size={13} /> : <Clock aria-hidden="true" size={13} />}
              {postponed ? "Reactivar" : "Posponer"}
            </button>
          )}
        </div>

        {postponed && subtask.postpone_note && (
          <p title={subtask.postpone_note} className="truncate pt-1 font-source text-[12px] italic text-[#99a1af]">{subtask.postpone_note}</p>
        )}

        {eventName && (
          <p className="flex items-center gap-1 pt-1 font-source text-[12px]">
            <span className="font-semibold text-[#1e2939]">Evento:</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEventClick?.();
              }}
              className="rounded-sm font-medium text-[#8b1a1a] underline decoration-[#8b1a1a]/40 hover:decoration-[#8b1a1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
            >
              {eventName}
            </button>
          </p>
        )}

        {overdue && (
          <div className="flex items-center gap-1 pt-2">
            <span aria-hidden="true" className="h-[10px] w-[10px] rounded-full border border-[rgba(139,26,26,0.7)]" />
            <span className="font-source text-[11px] text-[rgba(139,26,26,0.7)]">Requiere acción</span>
          </div>
        )}

        {completed && (
          <div className="flex items-center gap-1 pt-2">
            <CheckSquare aria-hidden="true" size={12} className="text-[#007a55]" />
            <span className="font-source text-[11px] text-[#007a55]">Completada</span>
          </div>
        )}
      </div>
    </div>
  );
}
