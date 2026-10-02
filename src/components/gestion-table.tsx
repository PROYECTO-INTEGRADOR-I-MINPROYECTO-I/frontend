// Tabla de gestiones (Nombre/Tipo/Fecha/Descripción/Estado) extraída de la
// vista expandida de un evento (PIM1-111/event-detail-view.tsx) para
// reutilizarla en el wizard de creación (PIM1-117): la stage de "plan
// inicial" muestra la misma tabla, con una fila extra al inicio para agregar
// una gestión nueva (onAddNew). Las filas solo son clickeables si se pasa
// onOpenSubtask (en el wizard no hay detalle/edición todavía: ver nota en
// event-wizard.tsx).

import { Plus } from "lucide-react";
import { formatShortDateEs } from "../lib/dates";
import type { Subtask } from "../lib/types";

interface GestionTableProps {
  /** Ya ordenadas por el caller (ver sortSubtasksByDateThenHours). */
  items: Subtask[];
  onOpenSubtask?: (subtask: Subtask) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  emptyHint?: string;
}

export function GestionTable({
  items,
  onOpenSubtask,
  onAddNew,
  addNewLabel = "Agregar gestión",
  emptyHint = "Sin gestiones todavía.",
}: GestionTableProps) {
  if (items.length === 0 && !onAddNew) {
    return <p className="font-source text-[13px] text-[#99a1af]">{emptyHint}</p>;
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-[#f3f4f6] font-jost text-[11px] tracking-[0.5px] text-[#99a1af] uppercase">
          <th className="py-2 pr-2 font-normal">Nombre</th>
          <th className="py-2 pr-2 font-normal">Tipo</th>
          <th className="py-2 pr-2 font-normal">Fecha</th>
          <th className="hidden py-2 pr-2 font-normal sm:table-cell">Descripción</th>
          <th className="py-2 font-normal">Estado</th>
        </tr>
      </thead>
      <tbody>
        {onAddNew && (
          <tr className="border-b border-[#f3f4f6] last:border-0">
            <td colSpan={5} className="py-2 pr-2">
              <button
                type="button"
                onClick={onAddNew}
                className="inline-flex items-center gap-1 font-jost text-[13px] text-[#8b1a1a] hover:text-[#6f1515]"
              >
                <Plus aria-hidden="true" size={14} />
                {addNewLabel}
              </button>
            </td>
          </tr>
        )}
        {items.map((subtask) => {
          const interactive = Boolean(onOpenSubtask);
          return (
            <tr
              key={subtask.subtask_id}
              // Sin role="button": eso pisa el role="row" nativo del <tr> y
              // rompe la navegación por tabla de un lector de pantalla.
              // tabIndex + onKeyDown alcanzan para que sea operable por
              // teclado sin perder la semántica de fila.
              tabIndex={interactive ? 0 : undefined}
              aria-label={interactive ? subtask.title : undefined}
              onClick={interactive ? () => onOpenSubtask?.(subtask) : undefined}
              onKeyDown={
                interactive
                  ? (keyEvent) => {
                      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                        keyEvent.preventDefault();
                        onOpenSubtask?.(subtask);
                      }
                    }
                  : undefined
              }
              className={
                interactive
                  ? "cursor-pointer border-b border-[#f3f4f6] last:border-0 hover:bg-[#f7f5f2] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#8b1a1a]"
                  : "border-b border-[#f3f4f6] last:border-0"
              }
            >
              <td className="max-w-[160px] truncate py-2 pr-2 font-source text-[13px] text-[#1e2939]">
                {subtask.title}
              </td>
              <td className="py-2 pr-2 font-source text-[13px] text-[#4a5565]">{subtask.category}</td>
              <td className="py-2 pr-2 font-source text-[13px] text-[#4a5565]">
                {formatShortDateEs(subtask.scheduled_date)}
              </td>
              <td className="hidden max-w-[220px] truncate py-2 pr-2 font-source text-[13px] text-[#99a1af] sm:table-cell">
                {subtask.description || "—"}
              </td>
              <td className="py-2 font-source text-[13px] text-[#4a5565]">
                {subtask.status === "done" ? "Completada" : "Pendiente"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
