// Tabla de gestiones (Nombre/Tipo/Fecha/Descripción/Estado) extraída de la
// vista expandida de un evento (PIM1-111/event-detail-view.tsx) para
// reutilizarla en el wizard de creación (PIM1-117): la stage de "plan
// inicial" muestra la misma tabla, con una fila extra al inicio para agregar
// una gestión nueva (onAddNew). Las filas solo son clickeables si se pasa
// onOpenSubtask (en el wizard no hay detalle/edición todavía: ver nota en
// event-wizard.tsx).

import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { formatShortDateEs } from "../lib/dates";
import type { Subtask } from "../lib/types";

const STATUS_LABELS: Record<Subtask["status"], string> = {
  pending: "Pendiente",
  done: "Completada",
  postponed: "Pospuesta",
};

interface GestionTableProps {
  /** Ya ordenadas por el caller (ver sortSubtasksByDateThenHours). */
  items: Subtask[];
  onOpenSubtask?: (subtask: Subtask) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  emptyHint?: string;
  /** Si viene, agrega la columna Evento (vista de progreso global). */
  eventNameById?: Record<number, string>;
}

export function GestionTable({
  items,
  onOpenSubtask,
  onAddNew,
  addNewLabel = "Agregar gestión",
  emptyHint = "Sin gestiones todavía.",
  eventNameById,
}: GestionTableProps) {
  if (items.length === 0 && !onAddNew) {
    return <p className="font-source text-[13px] text-[#99a1af]">{emptyHint}</p>;
  }

  const withEvent = Boolean(eventNameById);

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <colgroup>
        <col className={withEvent ? "w-[18%]" : "w-[28%]"} />
        {withEvent && <col className="w-[20%]" />}
        <col className={withEvent ? "w-[14%]" : "w-[16%]"} />
        <col className={withEvent ? "w-[10%]" : "w-[12%]"} />
        <col className={withEvent ? "w-[7%]" : "w-[10%]"} />
        <col className={withEvent ? "hidden w-[16%] sm:table-column" : "hidden w-[20%] sm:table-column"} />
        <col className={withEvent ? "w-[15%]" : "w-[14%]"} />
      </colgroup>
      <thead>
        <tr className="border-b border-[#f3f4f6] font-jost text-[11px] tracking-[0.5px] text-[#99a1af] uppercase">
          <th className="py-2 pr-2 font-normal">Nombre</th>
          {withEvent && <th className="py-2 pr-2 font-normal">Evento</th>}
          <th className="py-2 pr-2 font-normal">Tipo</th>
          <th className="py-2 pr-2 font-normal">Fecha</th>
          <th className="py-2 pr-2 font-normal">Horas</th>
          <th className="hidden py-2 pr-2 font-normal sm:table-cell">Descripción</th>
          <th className="py-2 font-normal">Estado</th>
        </tr>
      </thead>
      <tbody>
        {onAddNew && (
          <tr className="border-b border-[#f3f4f6] last:border-0">
            <td colSpan={withEvent ? 7 : 6} className="py-2 pr-2">
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
              <td className="truncate py-2 pr-2 font-source text-[13px] text-[#1e2939]">
                {subtask.title}
              </td>
              {withEvent && (
                <td className="py-2 pr-2 font-source text-[13px]">
                  <Link
                    to={`/progreso/${subtask.eid}`}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    title={eventNameById?.[subtask.eid]}
                    className="block truncate whitespace-nowrap text-[#8b1a1a] hover:underline"
                  >
                    {eventNameById?.[subtask.eid] ?? "—"}
                  </Link>
                </td>
              )}
              <td className="whitespace-nowrap py-2 pr-2 font-source text-[13px] text-[#4a5565]">{subtask.category}</td>
              <td className="py-2 pr-2 font-source text-[13px] text-[#4a5565]">
                {formatShortDateEs(subtask.scheduled_date)}
              </td>
              <td className="py-2 pr-2 font-source text-[13px] text-[#4a5565]">{Number(subtask.estimated_hours) || 0} h</td>
              <td className="hidden truncate py-2 pr-2 font-source text-[13px] text-[#99a1af] sm:table-cell">
                {subtask.description || "—"}
              </td>
              <td className="py-2 font-source text-[13px] text-[#4a5565]">
                {STATUS_LABELS[subtask.status]}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
