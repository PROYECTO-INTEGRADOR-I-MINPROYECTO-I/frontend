// Tarjeta de gestión (PIM1-27, ver hoy-seleccion-evento.tsx en el Figma para
// las medidas/colores exactos). Toda la tarjeta es un botón accesible que
// abre el detalle: el aria-label lleva el título para que quede claro aunque
// el resto sean chips y badges sin texto asociado a un label.

import { CheckSquare } from "lucide-react";
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
}

export function SubtaskCard({ subtask, onOpen, overdue = false, completed = false }: SubtaskCardProps) {
  const categoryStyle = categoryChipStyle(subtask.category);
  const hoursLabel = formatDuration(subtask.estimated_hours);

  return (
    <button
      type="button"
      onClick={() => onOpen(subtask)}
      aria-label={subtask.title}
      className={cn(
        "flex w-full flex-col rounded-lg border bg-white p-4 text-left transition-colors hover:border-[#d4d5d7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
        overdue ? "border-[rgba(139,26,26,0.1)]" : "border-[#f3f4f6]",
        completed && "opacity-60"
      )}
    >
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
    </button>
  );
}
