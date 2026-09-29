// Portada de un evento: color sólido o imagen (16:9), reutilizada tanto en
// la card del roulette de Eventos como en el banner de la vista expandida.
// Al pasar el mouse aparece un botón para personalizarla (color de una
// paleta fija o un enlace a imagen); se guarda con event-cover-override.ts.
// Mismo patrón de popover cerrable con click afuera que EventMenu.

import { useEffect, useRef, useState } from "react";
import { Palette, X } from "lucide-react";
import { COVER_PALETTE, eventCoverColor } from "../lib/event-display";
import { getEventCoverOverride, setEventCoverOverride, type EventCoverOverride } from "../lib/event-cover-override";
import type { Event } from "../lib/types";
import { cn } from "../lib/utils";

interface EventCoverProps {
  event: Event;
  className?: string;
}

export function EventCover({ event, className }: EventCoverProps) {
  const [override, setOverride] = useState<EventCoverOverride | null>(() => getEventCoverOverride(event.eid));
  const [isEditing, setIsEditing] = useState(false);
  const [imageDraft, setImageDraft] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    function handleClickOutside(mouseEvent: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(mouseEvent.target as Node)) {
        setIsEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing]);

  function applyOverride(next: EventCoverOverride | null) {
    setEventCoverOverride(event.eid, next);
    setOverride(next);
    setIsEditing(false);
  }

  function handleImageSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    const trimmed = imageDraft.trim();
    if (!trimmed) return;
    applyOverride({ kind: "image", value: trimmed });
  }

  const backgroundStyle: React.CSSProperties =
    override?.kind === "image"
      ? { backgroundImage: `url(${override.value})`, backgroundSize: "cover", backgroundPosition: "center" }
      : { backgroundColor: override?.kind === "color" ? override.value : eventCoverColor(event.name) };

  return (
    <div ref={rootRef} className={cn("group relative", className)}>
      <div className="h-full w-full" style={backgroundStyle} aria-hidden="true" />

      <button
        type="button"
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          setImageDraft(override?.kind === "image" ? override.value : "");
          setIsEditing((prev) => !prev);
        }}
        onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
        aria-label="Cambiar portada del evento"
        className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <Palette aria-hidden="true" size={14} />
      </button>

      {isEditing && (
        <div
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
          className="absolute top-10 right-2 z-40 w-[220px] rounded-[6px] border border-[#e1e5ea] bg-white p-3 text-left shadow-sm"
        >
          <p className="mb-2 font-jost text-[11px] tracking-[0.5px] text-[#99a1af] uppercase">Color</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {COVER_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => applyOverride({ kind: "color", value: color })}
                aria-label={`Usar color ${color}`}
                className={cn(
                  "h-6 w-6 rounded-full border-2",
                  override?.kind === "color" && override.value === color ? "border-[#101828]" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <p className="mb-2 font-jost text-[11px] tracking-[0.5px] text-[#99a1af] uppercase">Imagen</p>
          <form onSubmit={handleImageSubmit} className="flex flex-col gap-2">
            <label htmlFor={`cover-image-${event.eid}`} className="sr-only">
              Enlace de imagen
            </label>
            <input
              id={`cover-image-${event.eid}`}
              type="url"
              value={imageDraft}
              onChange={(changeEvent) => setImageDraft(changeEvent.target.value)}
              placeholder="https://..."
              className="rounded border border-[#e5e7eb] px-2 py-1 font-source text-[13px] text-[#1e2939]"
            />
            <button type="submit" className="rounded bg-[#8b1a1a] py-1 font-jost text-[12px] text-white">
              Usar esta imagen
            </button>
          </form>

          {override && (
            <button
              type="button"
              onClick={() => applyOverride(null)}
              className="mt-3 flex w-full items-center justify-center gap-1 font-jost text-[12px] text-[#4a5565] underline"
            >
              <X aria-hidden="true" size={12} />
              Quitar personalización
            </button>
          )}
        </div>
      )}
    </div>
  );
}
