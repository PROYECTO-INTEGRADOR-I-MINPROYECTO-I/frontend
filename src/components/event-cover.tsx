// Portada de un evento: color sólido o imagen (16:9), reutilizada tanto en
// la card del roulette de Eventos como en el banner de la vista expandida.
// Al pasar el mouse aparece un botón para personalizarla (color de una
// paleta fija o un enlace a imagen), que se guarda en el backend (PIM1-120,
// PATCH /eventos/<eid>/ con cover_kind/cover_value) y se refleja de
// inmediato porque el padre actualiza el `event` que le pasa de vuelta.
// Mismo patrón de popover cerrable con click afuera que EventMenu.

import { useEffect, useRef, useState } from "react";
import { Palette, X } from "lucide-react";
import { apiFetch, ApiError } from "../lib/api";
import { COVER_PALETTE, eventCoverColor } from "../lib/event-display";
import type { Event } from "../lib/types";
import { cn } from "../lib/utils";

interface EventCoverProps {
  event: Event;
  /** El PATCH devuelve el evento completo; el padre lo mezcla en su lista para que todas las vistas se actualicen. */
  onEventCoverUpdated: (event: Event) => void;
  className?: string;
}

export function EventCover({ event, onEventCoverUpdated, className }: EventCoverProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [imageDraft, setImageDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function saveCover(kind: "color" | "image" | null, value: string | null) {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Event>(`/eventos/${event.eid}/`, {
        method: "PATCH",
        body: JSON.stringify({ cover_kind: kind, cover_value: value }),
      });
      onEventCoverUpdated(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos guardar la portada.");
    } finally {
      setSaving(false);
    }
  }

  function handleImageSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    const trimmed = imageDraft.trim();
    if (!trimmed) return;
    saveCover("image", trimmed);
  }

  const hasOverride = Boolean(event.cover_kind && event.cover_value);
  const backgroundStyle: React.CSSProperties =
    event.cover_kind === "image" && event.cover_value
      ? { backgroundImage: `url(${event.cover_value})`, backgroundSize: "cover", backgroundPosition: "center" }
      : {
          backgroundColor:
            event.cover_kind === "color" && event.cover_value ? event.cover_value : eventCoverColor(event.name),
        };

  return (
    <div ref={rootRef} className={cn("group relative", className)}>
      <div className="h-full w-full" style={backgroundStyle} aria-hidden="true" />

      <button
        type="button"
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          setImageDraft(event.cover_kind === "image" && event.cover_value ? event.cover_value : "");
          setError(null);
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
          {error && (
            <p role="alert" className="mb-2 font-source text-[12px] text-[#8b1a1a]">
              {error}
            </p>
          )}

          <p className="mb-2 font-jost text-[11px] tracking-[0.5px] text-[#99a1af] uppercase">Color</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {COVER_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                disabled={saving}
                onClick={() => saveCover("color", color)}
                aria-label={`Usar color ${color}`}
                className={cn(
                  "h-6 w-6 rounded-full border-2 disabled:opacity-50",
                  event.cover_kind === "color" && event.cover_value === color
                    ? "border-[#101828]"
                    : "border-transparent"
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
              disabled={saving}
              className="rounded border border-[#e5e7eb] px-2 py-1 font-source text-[13px] text-[#1e2939] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-[#8b1a1a] py-1 font-jost text-[12px] text-white disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Usar esta imagen"}
            </button>
          </form>

          {hasOverride && (
            <button
              type="button"
              disabled={saving}
              onClick={() => saveCover(null, null)}
              className="mt-3 flex w-full items-center justify-center gap-1 font-jost text-[12px] text-[#4a5565] underline disabled:opacity-50"
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
