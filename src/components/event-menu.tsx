// Selector "Todos los eventos" / nombre del evento seleccionado (Figma nodo
// 5:3716, adaptado en PIM1-12). Al desplegarse lista "Todos" (modo agregado),
// los eventos del usuario, y una fila final "Nuevo" para crear uno.
// Componente controlado (PIM1-31): HomePage es dueña del listado y de su
// carga, porque también necesita mutarlo al editar/borrar eventos; EventMenu
// solo se encarga de la interacción del menú (abrir/cerrar, navegación con
// flechas, foco).

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe, Pencil, Plus, Trash2 } from "lucide-react";
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
    // botón disparador); acá solo falta el foco imperativo. "Todos" (índice 0)
    // siempre se renderiza sin importar el status, así que no hay que esperar
    // a "ready" como antes.
    if (open) {
      itemRefs.current[0]?.focus();
    }
  }, [open]);

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null;
    if (rootRef.current && (!nextTarget || !rootRef.current.contains(nextTarget))) {
      setOpen(false);
    }
  }

  const selectedEvent = events.find((event) => event.eid === selectedEventId) ?? null;
  // Índices del roving tabindex, en el orden en que se renderizan las filas:
  // "Todos" (0) primero, luego los eventos, luego "Nuevo", y por último
  // "Editar evento"/"Eliminar evento" solo si hay selección.
  const todosIndex = 0;
  const newIndex = events.length + 1;
  const editEventIndex = events.length + 2;
  const deleteEventIndex = events.length + 3;
  const rowCount = events.length + 2 + (selectedEvent ? 2 : 0);

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

  function selectAll() {
    onSelect(null);
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
        className="inline-flex items-center gap-1.5 font-jost text-[32px] font-normal tracking-[-0.6px] text-[#8b1a1a] underline decoration-2 underline-offset-4 hover:decoration-[#5c1717] hover:text-[#5c1717]"
      >
        {selectedEvent?.name ?? "Todos los eventos"}
        <ChevronDown size={22} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Eventos"
          onKeyDown={handleMenuKeyDown}
          className="absolute top-[calc(100%+8px)] left-1/2 z-40 w-[220px] -translate-x-1/2 rounded-[6px] border border-[#e1e5ea] bg-white py-1 shadow-sm"
        >
          {/* "Todos": vuelve al modo agregado (selectedEventId = null). Se
              renderiza siempre, sin depender de status, porque no lista
              eventos: es un filtro fijo, no una carga de datos. */}
          <button
            ref={(node) => {
              itemRefs.current[todosIndex] = node;
            }}
            type="button"
            role="menuitemradio"
            aria-checked={selectedEventId === null}
            tabIndex={activeIndex === todosIndex ? 0 : -1}
            onClick={selectAll}
            onFocus={() => setActiveIndex(todosIndex)}
            className={cn(
              "flex w-full items-center justify-between border-b border-[#e1e5ea] px-3 py-2 text-left font-jost text-[12px] text-[#101828] hover:bg-[#f7f5f2] focus-visible:bg-[#f7f5f2] focus-visible:outline-none",
              selectedEventId === null && "bg-[#f7f5f2] font-semibold"
            )}
          >
            Todos
            <Globe size={14} aria-hidden="true" />
          </button>

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
              const itemIndex = index + 1; // +1 porque "Todos" ocupa el índice 0
              return (
                <button
                  key={event.eid}
                  ref={(node) => {
                    itemRefs.current[itemIndex] = node;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  tabIndex={activeIndex === itemIndex ? 0 : -1}
                  onClick={() => selectEvent(event)}
                  onFocus={() => setActiveIndex(itemIndex)}
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
              itemRefs.current[newIndex] = node;
            }}
            type="button"
            role="menuitem"
            tabIndex={activeIndex === newIndex ? 0 : -1}
            onClick={startCreate}
            onFocus={() => setActiveIndex(newIndex)}
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
