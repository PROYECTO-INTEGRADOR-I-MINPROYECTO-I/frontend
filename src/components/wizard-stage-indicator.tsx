// Círculos numerados compartidos por los wizards de creación (evento y
// gestión, PIM1-117 — ver "Correcciones de UI dadas por el profesor durante
// clínica de sprint 1": "Stages enumeradas en círculos, a las cuales el
// usuario puede devolverse o avanzar"). Una X roja sobre el círculo + tooltip
// (title nativo, suficiente para esta primera versión) marca una stage con
// un error de validación pendiente.

import { XCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface WizardStageIndicatorProps {
  total: number;
  current: number;
  furthest: number;
  disabled: boolean;
  errorFor: (index: number) => string | undefined;
  onNavigate: (index: number) => void;
}

export function WizardStageIndicator({
  total,
  current,
  furthest,
  disabled,
  errorFor,
  onNavigate,
}: WizardStageIndicatorProps) {
  return (
    <div role="tablist" aria-label="Pasos del formulario" className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, index) => {
        const reached = index <= furthest && !disabled;
        const isCurrent = index === current;
        const error = errorFor(index);
        return (
          <div key={index} className="relative">
            {error && (
              <span
                aria-hidden="true"
                title={error}
                className="absolute -top-1.5 -right-1.5 z-10 grid h-4 w-4 place-items-center rounded-full bg-white"
              >
                <XCircle size={14} className="text-red-600" />
              </span>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-label={`Paso ${index + 1}`}
              title={error}
              disabled={!reached}
              onClick={() => onNavigate(index)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border font-jost text-[13px] disabled:cursor-not-allowed",
                isCurrent
                  ? "border-[#8b1a1a] bg-[#8b1a1a] text-white"
                  : reached
                    ? "border-[#8b1a1a] text-[#8b1a1a]"
                    : "border-[#e5e7eb] text-[#99a1af]"
              )}
            >
              {index + 1}
            </button>
          </div>
        );
      })}
    </div>
  );
}
