// Pill "Nuevo Evento" / nombre del evento seleccionado (Figma nodo 5:3716).
// Al desplegarse lista los eventos del usuario y una fila final "Nuevo" para
// crear uno. El listado se carga una vez al montar y se puede reintentar.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { apiFetch, ApiError } from "../lib/api";
import type { Event } from "../lib/types";
import { cn } from "../lib/utils";

interface EventMenuProps {
  selectedEventId: number | null;
  onSelect: (event: Event | null) => void;
  onCreateNew: () => void;
  /** Evento recién creado desde el modal: se agrega al listado y se selecciona. */
  newEvent?: Event | null;
  onNewEventConsumed?: () => void;
}

type Status = "loading" | "ready" | "error";

export function EventMenu({ selectedEventId, onSelect, onCreateNew, newEvent, onNewEventConsumed }: EventMenuProps) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  async function load() {
    setStatus("loading");
    try {
      const data = await apiFetch<Event[]>("/eventos/");
      setEvents(data);
      setStatus("ready");
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "No pudimos cargar tus eventos.");
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
    // Solo al montar: la recarga manual usa el botón "Reintentar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!newEvent) return;
    setEvents((prev) => [newEvent, ...prev.filter((event) => event.eid !== newEvent.eid)]);
    onNewEventConsumed?.();
  }, [newEvent, onNewEventConsumed]);

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
    // Si el menú se abre mientras la lista todavía está cargando, los
    // botones aún no existen: hay que esperar a que el status pase a
    // "ready" para poder enfocar el primer ítem.
    if (open && status === "ready") {
      setActiveIndex(0);
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
  const rowCount = events.length + 1; // + fila "Nuevo"

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
        onClick={() => setOpen((prev) => !prev)}
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
          className="absolute top-[calc(100%+8px)] right-0 z-40 w-[150px] rounded-[6px] border border-[#e1e5ea] bg-white py-1 shadow-sm"
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
                onClick={load}
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
            events.map((event, index) => (
              <button
                key={event.eid}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={event.eid === selectedEventId}
                tabIndex={activeIndex === index ? 0 : -1}
                onClick={() => selectEvent(event)}
                onFocus={() => setActiveIndex(index)}
                className={cn(
                  "block w-full border-b border-[#e1e5ea] px-3 py-2 text-left font-jost text-[12px] text-[#101828] hover:bg-[#f7f5f2] focus-visible:bg-[#f7f5f2] focus-visible:outline-none",
                  event.eid === selectedEventId && "bg-[#f7f5f2] font-semibold"
                )}
              >
                {event.name}
              </button>
            ))}

          <button
            ref={(node) => {
              itemRefs.current[events.length] = node;
            }}
            type="button"
            role="menuitem"
            tabIndex={activeIndex === events.length ? 0 : -1}
            onClick={startCreate}
            onFocus={() => setActiveIndex(events.length)}
            className="flex w-full items-center justify-between px-3 py-2 text-left font-jost text-[12px] text-[rgba(16,24,40,0.6)] hover:bg-[#f7f5f2] focus-visible:bg-[#f7f5f2] focus-visible:outline-none"
          >
            Nuevo
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
