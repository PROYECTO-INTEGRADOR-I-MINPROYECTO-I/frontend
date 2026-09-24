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

import { Check, CheckSquare } from "lucide-react";
import type { Subtask } from "../lib/types";
import { categoryChipStyle, formatDuration } from "../lib/subtask-display";
import { formatShortDateEs } from "../lib/dates";
import { cn } from "../lib/utils";

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
}

export function SubtaskCard({
  subtask,
  onOpen,
  overdue = false,
  completed = false,
  onToggleComplete,
  pending = false,
}: SubtaskCardProps) {
  const categoryStyle = categoryChipStyle(subtask.category);
  const hoursLabel = formatDuration(subtask.estimated_hours);
  const isDone = subtask.status === "done";

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
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
      aria-label={subtask.title}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border bg-white p-4 text-left transition-colors hover:border-[#d4d5d7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
        overdue ? "border-[rgba(139,26,26,0.1)]" : "border-[#f3f4f6]",
        completed && "opacity-60"
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
          <span className="shrink-0 rounded-full bg-[#f3f4f6] px-2 py-0.5 font-jost text-[10px] tracking-[0.25px] text-[#4a5565] uppercase">
            {hoursLabel}
          </span>
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
        </div>

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
