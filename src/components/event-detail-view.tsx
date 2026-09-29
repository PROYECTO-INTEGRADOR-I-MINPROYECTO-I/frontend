// Vista expandida de un evento (HU-13/PIM1-111, paso 1: solo información del
// evento + editar/borrar). Reemplaza al "no teníamos forma de ver la
// información del evento aparte de editar" que señaló el profesor en la
// clínica de Sprint 1. Las tablas de gestiones (Para hoy/Vencidas/Próximas/
// Completadas) quedan para un paso siguiente.

import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { formatShortDateEs, isoDateTimeToLocalDateString } from "../lib/dates";
import type { Event } from "../lib/types";

interface EventDetailViewProps {
  event: Event;
  eventTypeName?: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function EventDetailView({ event, eventTypeName, onBack, onEdit, onDelete }: EventDetailViewProps) {
  const dateLabel = formatShortDateEs(isoDateTimeToLocalDateString(event.due_date));

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

        {/* TODO(HU-13, paso 2): tablas Para hoy/Vencidas/Próximas/Completadas con
            contador y filtro por tipo, ver Correcciones de UI...txt. */}
      </div>
    </div>
  );
}
