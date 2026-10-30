// Modal de detalle de una gestión, con Editar, Borrar y completar (US-09):
// el pie tiene arriba el botón grande "Marcar como completada" (oculto si ya
// está completada o pospuesta, retro del Sprint 4), y abajo Editar/Borrar lado a lado — corrección del profesor
// (clínica de Sprint 1): las 3 acciones deben verse como botones con ícono,
// no como un link de texto.
// El toggle de completar lo controla el padre (ver handleToggleComplete en
// homepage.tsx, con actualización optimista y reversión si falla el PATCH).

import { useRef, useState } from "react";
import { Calendar, Check, Clock, Pencil, Play, Trash2 } from "lucide-react";
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
  /** Sprint 3 / C1: abre el popup de reprogramación (ver ReprogramModal). */
  onReprogram: (subtask: Subtask) => void;
  onPostpone?: (subtask: Subtask) => void;
  onReactivate?: (subtask: Subtask) => void;
  /** Deshabilita el botón mientras el PATCH está en curso, para evitar dobles clics. */
  togglePending?: boolean;
  /** Error del último intento de completar/despausar, con su acción de reintento. */
  toggleError?: SubtaskToggleError | null;
  /** Nota de una gestión pospuesta; sin esta prop no se muestra la sección. */
  onSaveNote?: (subtask: Subtask, note: string) => void;
  focusNote?: boolean;
}

export function SubtaskDetailModal({
  subtask,
  onClose,
  onEdit,
  onDelete,
  onToggleComplete,
  onReprogram,
  onPostpone,
  onReactivate,
  togglePending = false,
  toggleError = null,
  onSaveNote,
  focusNote = false,
}: SubtaskDetailModalProps) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const timeStatus = subtaskTimeStatus(subtask.status, subtask.scheduled_date, todayLocalDateString());
  const timeStatusStyle = TIME_STATUS_STYLES[timeStatus];
  const categoryStyle = categoryChipStyle(subtask.category);
  const hoursLabel = formatDuration(subtask.estimated_hours);
  const isDone = subtask.status === "done";
  const isPostponed = subtask.status === "postponed";
  const action = isPostponed ? onReactivate : onPostpone;

  return (
    <Modal
      open
      onClose={onClose}
      initialFocusRef={focusNote ? noteRef : undefined}
      title={subtask.title}
      chips={[
        { label: TIME_STATUS_LABELS[timeStatus], style: { backgroundColor: timeStatusStyle.bg, color: timeStatusStyle.text } },
        { label: subtask.category, style: { backgroundColor: categoryStyle.bg, color: categoryStyle.text } },
      ]}
      footer={
        <>
          {!isDone && !isPostponed && (
            <button
              type="button"
              onClick={() => onToggleComplete(subtask)}
              disabled={togglePending}
              aria-busy={togglePending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#8b1a1a] py-[10px] font-jost text-[14px] text-white disabled:opacity-60"
            >
              <Check aria-hidden="true" size={16} />
              Marcar como completada
            </button>
          )}
          <button
            type="button"
            onClick={() => onReprogram(subtask)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[0.635px] border-[#8b1a1a] py-[10px] font-jost text-[14px] text-[#8b1a1a]"
          >
            <Calendar aria-hidden="true" size={16} />
            Reprogramar
          </button>
          {!isDone && action && (
            <button
              type="button"
              onClick={() => action(subtask)}
              disabled={togglePending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[0.635px] border-[#8b1a1a] py-[10px] font-jost text-[14px] text-[#8b1a1a] disabled:opacity-60"
            >
              {isPostponed ? <Play aria-hidden="true" size={16} /> : <Clock aria-hidden="true" size={16} />}
              {isPostponed ? "Reactivar" : "Posponer"}
            </button>
          )}
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
            <span className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">Fecha</span>
            <span className="font-source text-[14px] text-[#1e2939]">{formatShortDateEs(subtask.scheduled_date)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">Horas estimadas</span>
            <span className="font-source text-[14px] text-[#1e2939]">{hoursLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-[#f3f4f6] pt-4">
          <span className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">Descripción</span>
          <p className="font-source text-[14px] leading-[22.75px] text-[#1e2939]">
            {subtask.description || "Sin descripción."}
          </p>
        </div>

        {isPostponed && onSaveNote && (
          <NoteSection
            key={`${subtask.subtask_id}:${subtask.postpone_note ?? ""}`}
            subtask={subtask}
            onSave={onSaveNote}
            saving={togglePending}
            textareaRef={noteRef}
          />
        )}
      </div>
    </Modal>
  );
}

// Se remonta con key al cambiar la nota guardada, así el borrador nunca queda viejo.
function NoteSection({
  subtask,
  onSave,
  saving,
  textareaRef,
}: {
  subtask: Subtask;
  onSave: (subtask: Subtask, note: string) => void;
  saving: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const savedNote = subtask.postpone_note ?? "";
  const [note, setNote] = useState(savedNote);

  return (
    <div className="flex flex-col gap-1 border-t border-[#f3f4f6] pt-4">
      <div className="flex items-center justify-between">
        <label htmlFor="postpone-note" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
          Nota
        </label>
        {note.trim() !== savedNote && (
          <button
            type="button"
            onClick={() => onSave(subtask, note)}
            disabled={saving}
            className="font-jost text-[12px] text-[#8b1a1a] underline disabled:opacity-60"
          >
            Guardar nota
          </button>
        )}
      </div>
      <textarea
        id="postpone-note"
        ref={textareaRef}
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="¿Por qué la pospusiste?"
        className="w-full rounded-lg border border-[#e5e7eb] p-2 font-source text-[14px] text-[#1e2939]"
      />
    </div>
  );
}
