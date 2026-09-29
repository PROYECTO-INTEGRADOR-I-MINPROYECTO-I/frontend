// Vista expandida de un evento (HU-13/PIM1-111). Paso 1: información del
// evento + editar/borrar. Paso 2 (este): las 4 tablas de gestiones (Para
// hoy/Vencidas/Próximas/Completadas), expandidas por defecto, con contador
// "- X GESTIONES" y columnas Nombre/Tipo/Fecha/Descripción/Estado — ver
// Correcciones de UI...txt. Clickear una fila para abrir el detalle de esa
// gestión queda para un paso siguiente (ver el comentario en events-view.tsx
// sobre por qué SubtaskFormModal necesita un ajuste primero).

import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { formatShortDateEs, isoDateTimeToLocalDateString, todayLocalDateString } from "../lib/dates";
import { sortCompletedSubtasksByDateDesc, sortSubtasksByDateThenHours, subtaskTimeStatus } from "../lib/subtask-display";
import type { Event, Subtask } from "../lib/types";

interface EventDetailViewProps {
  event: Event;
  eventTypeName?: string;
  subtasks: Subtask[];
  subtasksLoading: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function EventDetailView({
  event,
  eventTypeName,
  subtasks,
  subtasksLoading,
  onBack,
  onEdit,
  onDelete,
}: EventDetailViewProps) {
  const dateLabel = formatShortDateEs(isoDateTimeToLocalDateString(event.due_date));
  const today = todayLocalDateString();

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

  return (
    <div className="px-8 pb-8">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 font-jost text-[13px] text-[#4a5565] hover:text-[#101828]"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Volver a Eventos
        </button>

        <div className="flex flex-col gap-4 rounded-lg border border-[#f3f4f6] bg-white p-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-jost text-[24px] leading-[30px] text-[#101828]">{event.name}</h1>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 font-jost text-[13px] text-[#4a5565] hover:text-[#101828]"
              >
                <Pencil aria-hidden="true" size={14} />
                Editar
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1 font-jost text-[13px] text-[#8b1a1a] hover:text-[#6f1515]"
              >
                <Trash2 aria-hidden="true" size={14} />
                Borrar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {eventTypeName && (
              <span className="shrink-0 rounded px-[6px] py-0.5 font-jost text-[10px] text-[#4a5565] bg-[#f3f4f6]">
                {eventTypeName}
              </span>
            )}
            <span className="font-source text-[13px] text-[#99a1af]">{dateLabel}</span>
          </div>

          {event.place && (
            <p className="font-source text-[14px] text-[#4a5565]">
              <span className="font-jost text-[11px] tracking-[0.5px] text-[#99a1af] uppercase">Lugar: </span>
              {event.place}
            </p>
          )}

          {event.client_contact && (
            <p className="font-source text-[14px] text-[#4a5565]">
              <span className="font-jost text-[11px] tracking-[0.5px] text-[#99a1af] uppercase">Contacto: </span>
              {event.client_contact}
            </p>
          )}

          {event.description && (
            <p className="font-source text-[14px] leading-[22.75px] text-[#4a5565]">{event.description}</p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {subtasksLoading ? (
            <p className="font-source text-[13px] text-[#99a1af]">Cargando gestiones…</p>
          ) : (
            <>
              <GestionGroup label="Para hoy" items={paraHoy} emptyHint="Sin gestiones para hoy." />
              <GestionGroup label="Vencidas" items={vencidas} emptyHint="Sin gestiones vencidas." />
              <GestionGroup label="Próximas" items={proximas} emptyHint="Sin gestiones próximas." />
              <GestionGroup label="Completadas" items={completadas} emptyHint="Sin gestiones completadas." />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface GestionGroupProps {
  label: string;
  items: Subtask[];
  emptyHint: string;
}

function GestionGroup({ label, items, emptyHint }: GestionGroupProps) {
  return (
    <details open className="rounded-lg border border-[#f3f4f6] bg-white">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-jost text-[13px] tracking-[0.5px] text-[#101828] uppercase">
        <span>{label}</span>
        <span className="font-source text-[11px] normal-case text-[#99a1af]">- {items.length} GESTIONES</span>
      </summary>
      <div className="border-t border-[#f3f4f6] px-4 py-3">
        {items.length === 0 ? (
          <p className="font-source text-[13px] text-[#99a1af]">{emptyHint}</p>
        ) : (
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
              {items.map((subtask) => (
                <tr key={subtask.subtask_id} className="border-b border-[#f3f4f6] last:border-0">
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
