// Selector de duración de una gestión (PIM1-27+): reemplaza el
// <input type="number" step=0.5"> por chips de duraciones comunes más un
// stepper de 5 min. Trabaja en minutos "puertas adentro" y solo convierte a
// horas (con 2 decimales, lo que soporta `estimated_hours`) al notificar el
// cambio, para no tocar el resto del formulario ni el contrato del backend.

import { hoursToMinutes, minutesToHours, formatDuration } from "../lib/subtask-display";
import { cn } from "../lib/utils";

interface HoursPickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

const CHIP_MINUTES = [5, 10, 15, 30, 45, 60, 120, 240];
const MIN_MINUTES = 5;
const MAX_MINUTES = 24 * 60;
const STEP_MINUTES = 5;

export function HoursPicker({ id, value, onChange, invalid = false, describedBy }: HoursPickerProps) {
  const currentMinutes = value ? hoursToMinutes(value) : null;

  function setMinutes(minutes: number) {
    const clamped = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes));
    onChange(minutesToHours(clamped));
  }

  function step(delta: number) {
    // Si no hay valor todavía, "+" arranca en el mínimo (5 min); "−" está
    // deshabilitado en ese caso (ver canDecrement), así que nunca llega acá.
    const base = currentMinutes ?? 0;
    setMinutes(base + delta);
  }

  const canDecrement = currentMinutes !== null && currentMinutes > MIN_MINUTES;
  const canIncrement = currentMinutes === null || currentMinutes < MAX_MINUTES;

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={`${id}-label`}
      aria-required="true"
      aria-describedby={describedBy}
      aria-invalid={invalid}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap gap-2">
        {CHIP_MINUTES.map((minutes) => {
          const pressed = currentMinutes === minutes;
          return (
            <button
              key={minutes}
              type="button"
              aria-pressed={pressed}
              onClick={() => setMinutes(minutes)}
              className={cn(
                "rounded-full border px-[10px] py-1 font-jost text-[12px] transition-colors",
                pressed ? "border-[#8b1a1a] bg-[#8b1a1a] text-white" : "border-[#d4d5d7] text-[#4a5565]"
              )}
            >
              {formatDuration(minutesToHours(minutes))}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => step(-STEP_MINUTES)}
          disabled={!canDecrement}
          aria-label="Restar 5 minutos"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d4d5d7] font-jost text-[16px] text-[#4a5565] disabled:opacity-40"
        >
          −
        </button>
        <span
          role="status"
          aria-live="polite"
          className="min-w-[100px] text-center font-source text-[14px] text-[#1e2939]"
        >
          {value ? formatDuration(value) : "Sin definir"}
        </span>
        <button
          type="button"
          onClick={() => step(STEP_MINUTES)}
          disabled={!canIncrement}
          aria-label="Sumar 5 minutos"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d4d5d7] font-jost text-[16px] text-[#4a5565] disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
