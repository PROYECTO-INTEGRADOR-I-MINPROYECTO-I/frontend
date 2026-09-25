// Modal de detalle de una gestión, con Editar, Eliminar y completar (US-09):
// el pie tiene "Editar" y "Marcar como completada"/"Marcar como pendiente".
// El toggle de completar lo controla el padre (ver handleToggleComplete en
// homepage.tsx, con actualización optimista y reversión si falla el PATCH).

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
            onClick={() => onEdit(subtask)}
            className="flex-1 rounded-lg border border-[0.635px] border-[#8b1a1a] py-[10px] font-jost text-[14px] text-[#8b1a1a]"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onToggleComplete(subtask)}
            disabled={togglePending}
            aria-busy={togglePending}
            className="flex-1 rounded-lg bg-[#8b1a1a] py-[10px] font-jost text-[14px] text-white disabled:opacity-60"
          >
            {isDone ? "Marcar como pendiente" : "Marcar como completada"}
          </button>
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

        <div className="flex justify-end border-t border-[#f3f4f6] pt-4">
          <button
            type="button"
            onClick={() => onDelete(subtask)}
            className="font-jost text-[13px] text-[#8b1a1a] underline decoration-[#8b1a1a]/40 hover:decoration-[#8b1a1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
          >
            Eliminar gestión
          </button>
        </div>
      </div>
    </Modal>
  );
}
