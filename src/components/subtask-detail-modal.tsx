// Modal de detalle de una gestión, solo lectura (PIM1-27, luego PIM1-31
// añade Editar y Eliminar). Completar (US-09) no va en este ticket: el pie
// solo tiene "Editar", como en detalle.png.

import { formatShortDateEs, todayLocalDateString } from "../lib/dates";
import {
  categoryChipStyle,
  subtaskTimeStatus,
  TIME_STATUS_LABELS,
  TIME_STATUS_STYLES,
} from "../lib/subtask-display";
import type { Subtask } from "../lib/types";
import { Modal } from "./modal";

interface SubtaskDetailModalProps {
  subtask: Subtask;
  onClose: () => void;
  onEdit: (subtask: Subtask) => void;
  onDelete: (subtask: Subtask) => void;
}

export function SubtaskDetailModal({ subtask, onClose, onEdit, onDelete }: SubtaskDetailModalProps) {
  const timeStatus = subtaskTimeStatus(subtask.status, subtask.scheduled_date, todayLocalDateString());
  const timeStatusStyle = TIME_STATUS_STYLES[timeStatus];
  const categoryStyle = categoryChipStyle(subtask.category);
  const hours = Number(subtask.estimated_hours);
  const hoursLabel = Number.isFinite(hours) ? `${hours} h` : `${subtask.estimated_hours} h`;

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
        <button
          type="button"
          onClick={() => onEdit(subtask)}
          className="flex-1 rounded-lg border border-[0.635px] border-[#8b1a1a] py-[10px] font-jost text-[14px] text-[#8b1a1a]"
        >
          Editar
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
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
