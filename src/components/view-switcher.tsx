// Selector de vistas "Plan inicial" / "Hoy" (PIM1-96), debajo del header.
// Sigue el patrón WAI-ARIA de pestañas con activación automática:
// role="tablist"/"tab", navegación con flechas ← → (con wrap-around),
// Inicio/Fin para ir a la primera/última pestaña, y
// `aria-selected` reflejando la pestaña activa. Se expone como componente
// controlado (`value`/`onChange`) para reutilizarlo cuando exista la vista
// Hoy real.

import { useRef } from "react";
import { cn } from "../lib/utils";

export type ViewSwitcherValue = "plan" | "hoy";

interface ViewSwitcherOption {
  value: ViewSwitcherValue;
  label: string;
  panelId: string;
}

const OPTIONS: ViewSwitcherOption[] = [
  { value: "plan", label: "Plan inicial", panelId: "plan-inicial-panel" },
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

  return (
    <div role="tablist" aria-label="Vistas" className="flex w-fit gap-1 rounded-full border border-[#d4d5d7] p-1">
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
