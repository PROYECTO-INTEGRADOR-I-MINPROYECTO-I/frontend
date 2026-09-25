// Pill "Nuevo Evento" / nombre del evento seleccionado (Figma nodo 5:3716).
// Al desplegarse lista los eventos del usuario y una fila final "Nuevo" para
// crear uno. Componente controlado (PIM1-31): HomePage es dueña del listado
// y de su carga, porque también necesita mutarlo al editar/borrar eventos;
// EventMenu solo se encarga de la interacción del menú (abrir/cerrar,
// navegación con flechas, foco).

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import type { Event } from "../lib/types";
import { cn } from "../lib/utils";

type Status = "loading" | "ready" | "error";

interface EventMenuProps {
  events: Event[];
  status: Status;
  errorMessage?: string;
  onRetry: () => void;
  selectedEventId: number | null;
  onSelect: (event: Event | null) => void;
  onCreateNew: () => void;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
}

export function EventMenu({
  events,
  status,
  errorMessage,
  onRetry,
  selectedEventId,
  onSelect,
  onCreateNew,
  onEditEvent,
  onDeleteEvent,
}: EventMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    // activeIndex ya se resetea a 0 en el click que abre el menú (ver el
    // botón disparador); acá solo falta el foco imperativo, y hay que
    // esperar a que status pase a "ready" porque mientras carga los
    // botones de la lista todavía no existen.
    if (open && status === "ready") {
      itemRefs.current[0]?.focus();
    }
  }, [open, status]);

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null;
    if (rootRef.current && (!nextTarget || !rootRef.current.contains(nextTarget))) {
      setOpen(false);
    }
  }

  const selectedEvent = events.find((event) => event.eid === selectedEventId) ?? null;
  // "Nuevo" siempre está; "Editar evento"/"Eliminar evento" solo si hay
  // selección. Van al final como menuitem propios (no botones sueltos
  // dentro de la fila) para que participen del mismo roving tabindex y de
  // las flechas arriba/abajo, igual que el resto de filas del menú.
  const editEventIndex = events.length + 1;
  const deleteEventIndex = events.length + 2;
  const rowCount = events.length + (selectedEvent ? 3 : 1);

  function closeAndFocusTrigger() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveActiveIndex(delta: number) {
    setActiveIndex((prev) => {
      const next = (prev + delta + rowCount) % rowCount;
      itemRefs.current[next]?.focus();
      return next;
    });
  }

  function handleMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveIndex(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveIndex(-1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocusTrigger();
    }
  }

  function selectEvent(event: Event) {
    onSelect(event);
    closeAndFocusTrigger();
  }

  function startCreate() {
    onCreateNew();
    closeAndFocusTrigger();
  }

  return (
    <div ref={rootRef} className="relative" onBlur={handleBlur}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() =>
          setOpen((prev) => {
            const next = !prev;
            if (next) setActiveIndex(0); // el mismo evento que abre el menú resetea la selección activa
            return next;
          })
        }
        className="inline-flex items-center justify-center gap-[5px] rounded-full bg-[#8b1a1a] px-3 py-[6px] font-jost text-[12px] leading-4 text-white"
      >
        {selectedEvent?.name ?? "Nuevo Evento"}
        <ChevronDown size={17} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Eventos"
          onKeyDown={handleMenuKeyDown}
          className="absolute top-[calc(100%+8px)] right-0 z-40 w-[180px] rounded-[6px] border border-[#e1e5ea] bg-white py-1 shadow-sm"
        >
          {status === "loading" && (
            <p className="px-3 py-2 font-jost text-[12px] text-[rgba(16,24,40,0.6)]">Cargando…</p>
          )}

          {status === "error" && (
            <div className="px-3 py-2">
              <p role="alert" className="font-jost text-[12px] text-[#8b1a1a]">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-1 font-jost text-[12px] text-[#8b1a1a] underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {status === "ready" && events.length === 0 && (
            <p className="px-3 py-2 font-jost text-[12px] text-[rgba(16,24,40,0.6)]">Aún no tienes eventos.</p>
          )}

          {status === "ready" &&
            events.map((event, index) => {
              const isSelected = event.eid === selectedEventId;
              return (
                <button
                  key={event.eid}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  tabIndex={activeIndex === index ? 0 : -1}
                  onClick={() => selectEvent(event)}
                  onFocus={() => setActiveIndex(index)}
                  className={cn(
                    "block w-full truncate border-b border-[#e1e5ea] px-3 py-2 text-left font-jost text-[12px] text-[#101828] hover:bg-[#f7f5f2] focus-visible:bg-[#f7f5f2] focus-visible:outline-none",
                    isSelected && "bg-[#f7f5f2] font-semibold"
                  )}
                >
                  {event.name}
                </button>
              );
            })}

          <button
            ref={(node) => {
              itemRefs.current[events.length] = node;
            }}
            type="button"
            role="menuitem"
            tabIndex={activeIndex === events.length ? 0 : -1}
            onClick={startCreate}
            onFocus={() => setActiveIndex(events.length)}
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-left font-jost text-[12px] text-[rgba(16,24,40,0.6)] hover:bg-[#f7f5f2] focus-visible:bg-[#f7f5f2] focus-visible:outline-none",
              selectedEvent && "border-b border-[#e1e5ea]"
            )}
          >
            Nuevo
            <Plus size={14} aria-hidden="true" />
          </button>

          {selectedEvent && (
            <>
              <button
                ref={(node) => {
                  itemRefs.current[editEventIndex] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={activeIndex === editEventIndex ? 0 : -1}
                onFocus={() => setActiveIndex(editEventIndex)}
                onClick={() => {
                  onEditEvent(selectedEvent);
                  closeAndFocusTrigger();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left font-jost text-[12px] text-[#101828] hover:bg-[#f7f5f2] focus-visible:bg-[#f7f5f2] focus-visible:outline-none"
              >
                <Pencil size={13} aria-hidden="true" />
                Editar evento
              </button>
              <button
                ref={(node) => {
                  itemRefs.current[deleteEventIndex] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={activeIndex === deleteEventIndex ? 0 : -1}
                onFocus={() => setActiveIndex(deleteEventIndex)}
                onClick={() => {
                  onDeleteEvent(selectedEvent);
                  closeAndFocusTrigger();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left font-jost text-[12px] text-[#8b1a1a] hover:bg-[#fff0f0] focus-visible:bg-[#fff0f0] focus-visible:outline-none"
              >
                <Trash2 size={13} aria-hidden="true" />
                Eliminar evento
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
