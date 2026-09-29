// Selector de vistas "Eventos" / "Hoy" (PIM1-96), en la barra superior
// (PIM1-11). Sigue el patrón WAI-ARIA de pestañas con activación automática:
// role="tablist"/"tab", navegación con flechas ← → (con wrap-around),
// Inicio/Fin para ir a la primera/última pestaña, y
// `aria-selected` reflejando la pestaña activa. Se expone como componente
// controlado (`value`/`onChange`).
//
// PIM1-11/HU-13: lo que antes era la pestaña "Plan inicial" con las columnas
// Vencidas/Para hoy/Próximas en realidad siempre fue la vista "Hoy" (el
// profesor lo señaló en la clínica de Sprint 1). Ese contenido se reasignó a
// la pestaña "Hoy" (ahora la vista por defecto), y "Plan inicial" se
// renombró a "Eventos": la vista nueva que pide HU-13 (PIM1-111).

import { useRef } from "react";
import { cn } from "../lib/utils";

export type ViewSwitcherValue = "eventos" | "hoy";

interface ViewSwitcherOption {
  value: ViewSwitcherValue;
  label: string;
  panelId: string;
}

const OPTIONS: ViewSwitcherOption[] = [
  { value: "eventos", label: "Eventos", panelId: "eventos-panel" },
  { value: "hoy", label: "Hoy", panelId: "hoy-panel" },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a] focus-visible:outline-offset-2";

interface ViewSwitcherProps {
  value: ViewSwitcherValue;
  onChange: (value: ViewSwitcherValue) => void;
}

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusAndSelect(index: number) {
    const wrapped = (index + OPTIONS.length) % OPTIONS.length;
    const option = OPTIONS[wrapped];
    tabRefs.current[wrapped]?.focus();
    onChange(option.value);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAndSelect(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAndSelect(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAndSelect(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAndSelect(OPTIONS.length - 1);
    }
  }

  // Sin borde/fondo propios: el contenedor quedaba como una caja extra
  // flotando en la barra superior ahora que el selector vive ahí (antes,
  // en su propia fila debajo del header, sí se justificaba). Las pestañas
  // ya tienen su propio borde cuando no están seleccionadas.
  return (
    <div role="tablist" aria-label="Vistas" className="flex w-fit gap-1">
      {OPTIONS.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${option.value}-tab`}
            aria-selected={selected}
            aria-controls={option.panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "min-h-[44px] min-w-[110px] rounded-full px-4 font-jost text-[13px] transition-colors duration-200",
              selected ? "bg-[#8b1a1a] text-white" : "border border-[#d4d5d7] text-[#4a5565] hover:bg-[#fff0f0]",
              focusRing
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
