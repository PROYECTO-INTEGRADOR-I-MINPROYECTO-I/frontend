// Modal de detalle de una gestión, con Editar, Borrar y completar (US-09):
// el pie tiene arriba el botón grande "Marcar como completada"/"Marcar como
// pendiente", y abajo Editar/Borrar lado a lado — corrección del profesor
// (clínica de Sprint 1): las 3 acciones deben verse como botones con ícono,
// no como un link de texto.
// El toggle de completar lo controla el padre (ver handleToggleComplete en
// homepage.tsx, con actualización optimista y reversión si falla el PATCH).

import { Check, Pencil, Trash2 } from "lucide-react";
import { formatShortDateEs, todayLocalDateString } from "../lib/dates";
import {
  categoryChipStyle,
  formatDuration,
  subtaskTimeStatus,
  TIME_STATUS_LABELS,
  TIME_STATUS_STYLES,
} from "../lib/subtask-display";
import type { Subtask } from "../lib/types";
import { Modal } from "./modal";

export interface SubtaskToggleError {
  message: string;
  onRetry: () => void;
}

interface SubtaskDetailModalProps {
  subtask: Subtask;
  onClose: () => void;
  onEdit: (subtask: Subtask) => void;
  onDelete: (subtask: Subtask) => void;
  onToggleComplete: (subtask: Subtask) => void;
  /** Deshabilita el botón mientras el PATCH está en curso, para evitar dobles clics. */
  togglePending?: boolean;
  /** Error del último intento de completar/despausar, con su acción de reintento. */
  toggleError?: SubtaskToggleError | null;
}

export function SubtaskDetailModal({
  subtask,
  onClose,
  onEdit,
  onDelete,
  onToggleComplete,
  togglePending = false,
  toggleError = null,
}: SubtaskDetailModalProps) {
  const timeStatus = subtaskTimeStatus(subtask.status, subtask.scheduled_date, todayLocalDateString());
  const timeStatusStyle = TIME_STATUS_STYLES[timeStatus];
  const categoryStyle = categoryChipStyle(subtask.category);
  const hoursLabel = formatDuration(subtask.estimated_hours);
  const isDone = subtask.status === "done";

  return (
    <Modal
      open
      onClose={onClose}
      title={subtask.title}
      chips={[
        { label: TIME_STATUS_LABELS[timeStatus], style: { backgroundColor: timeStatusStyle.bg, color: timeStatusStyle.text } },
        { label: subtask.category, style: { backgroundColor: categoryStyle.bg, color: categoryStyle.text } },
      ]}
      footer={
        <>
          <button
            type="button"
            onClick={() => onToggleComplete(subtask)}
            disabled={togglePending}
            aria-busy={togglePending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#8b1a1a] py-[10px] font-jost text-[14px] text-white disabled:opacity-60"
          >
            <Check aria-hidden="true" size={16} />
            {isDone ? "Marcar como pendiente" : "Marcar como completada"}
          </button>
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => onEdit(subtask)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[0.635px] border-[#8b1a1a] py-[10px] font-jost text-[14px] text-[#8b1a1a]"
            >
              <Pencil aria-hidden="true" size={16} />
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDelete(subtask)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[0.635px] border-[#8b1a1a] py-[10px] font-jost text-[14px] text-[#8b1a1a] hover:bg-[#fff0f0]"
            >
              <Trash2 aria-hidden="true" size={16} />
              Borrar
            </button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {toggleError && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg bg-[#fff0f0] p-3 text-[13px] text-[#8b1a1a]">
            <span>{toggleError.message}</span>
            <button type="button" onClick={toggleError.onRetry} className="w-fit font-jost text-[12px] underline">
              Reintentar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">Fecha</span>
            <span className="font-source text-[14px] text-[#1e2939]">{formatShortDateEs(subtask.scheduled_date)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">Horas estimadas</span>
            <span className="font-source text-[14px] text-[#1e2939]">{hoursLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-[#f3f4f6] pt-4">
          <span className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">Descripción</span>
          <p className="font-source text-[14px] leading-[22.75px] text-[#1e2939]">
            {subtask.description || "Sin descripción."}
          </p>
        </div>
      </div>
    </Modal>
  );
}
