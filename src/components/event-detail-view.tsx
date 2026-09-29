// Vista expandida de un evento (HU-13/PIM1-111): información del evento +
// editar/borrar, y las 4 tablas de gestiones (Para hoy/Vencidas/Próximas/
// Completadas), expandidas por defecto, con contador "- X GESTIONES", una
// flecha que indica expandido/colapsado (el <details>/<summary> nativo pierde
// su marcador con `display: flex`, así que sin esto no había ninguna pista
// visual de que la tabla es desplegable) y columnas Nombre/Tipo/Fecha/
// Descripción/Estado — ver Correcciones de UI...txt. Cada tabla tiene su
// propio filtro por tipo (categoría), también pedido en las correcciones —
// siempre visible (incluso con una sola categoría) para que el filtro sea
// descubrible sin depender de cuántos tipos de gestión tenga el evento.
// Clickear una fila abre el mismo SubtaskDetailModal global que ya usa la
// vista Hoy (onOpenSubtask, ver homepage.tsx/events-view.tsx).

import { useState } from "react";
import { ArrowLeft, ChevronDown, Pencil, Trash2 } from "lucide-react";
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
  onOpenSubtask: (subtask: Subtask) => void;
}

export function EventDetailView({
  event,
  eventTypeName,
  subtasks,
  subtasksLoading,
  onBack,
  onEdit,
  onDelete,
  onOpenSubtask,
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
              <GestionGroup label="Para hoy" items={paraHoy} emptyHint="Sin gestiones para hoy." onOpenSubtask={onOpenSubtask} />
              <GestionGroup label="Vencidas" items={vencidas} emptyHint="Sin gestiones vencidas." onOpenSubtask={onOpenSubtask} />
              <GestionGroup label="Próximas" items={proximas} emptyHint="Sin gestiones próximas." onOpenSubtask={onOpenSubtask} />
              <GestionGroup
                label="Completadas"
                items={completadas}
                emptyHint="Sin gestiones completadas."
                onOpenSubtask={onOpenSubtask}
              />
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
  onOpenSubtask: (subtask: Subtask) => void;
}

function GestionGroup({ label, items, emptyHint, onOpenSubtask }: GestionGroupProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Se calculan sobre `items` (sin filtrar) para que las opciones del select
  // no desaparezcan al elegir una: las categorías disponibles son las que
  // tiene el grupo completo, no las del subconjunto ya filtrado.
  const categories = Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b));
  // Si `items` cambia (ej. refetch tras editar/completar una gestión en otra
  // pestaña) y la categoría elegida ya no existe en el grupo, no nos quedamos
  // mostrando "sin resultados" sin forma de volver: se vuelve a "Todos" sola.
  const effectiveFilter = categories.includes(categoryFilter) ? categoryFilter : "all";
  const visibleItems = effectiveFilter === "all" ? items : items.filter((item) => item.category === effectiveFilter);
  const filterId = `gestion-filter-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="rounded-lg border border-[#f3f4f6] bg-white"
    >
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-jost text-[13px] tracking-[0.5px] text-[#101828] uppercase">
        <span className="flex items-center gap-2">
          {label}
          <ChevronDown
            aria-hidden="true"
            size={16}
            className={`text-[#99a1af] transition-transform duration-150 ${isOpen ? "" : "rotate-180"}`}
          />
        </span>
        <span className="font-source text-[11px] normal-case text-[#99a1af]">- {visibleItems.length} GESTIONES</span>
      </summary>
      <div className="border-t border-[#f3f4f6] px-4 py-3">
        {items.length === 0 ? (
          <p className="font-source text-[13px] text-[#99a1af]">{emptyHint}</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <label htmlFor={filterId} className="font-jost text-[10px] tracking-[0.5px] text-[#99a1af] uppercase">
                Tipo
              </label>
              <select
                id={filterId}
                value={effectiveFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded border border-[#e5e7eb] bg-white px-2 py-1 font-source text-[13px] text-[#1e2939]"
              >
                <option value="all">Todos</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
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
                {visibleItems.map((subtask) => (
                  <tr
                    key={subtask.subtask_id}
                    // Sin role="button": eso pisa el role="row" nativo del <tr> y
                    // rompe la navegación por tabla de un lector de pantalla.
                    // tabIndex + onKeyDown alcanzan para que sea operable por
                    // teclado sin perder la semántica de fila.
                    tabIndex={0}
                    aria-label={subtask.title}
                    onClick={() => onOpenSubtask(subtask)}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                        keyEvent.preventDefault();
                        onOpenSubtask(subtask);
                      }
                    }}
                    className="cursor-pointer border-b border-[#f3f4f6] last:border-0 hover:bg-[#f7f5f2] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#8b1a1a]"
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
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </details>
  );
}
