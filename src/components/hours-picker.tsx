// Selector de duración de una gestión (PIM1-27+), dentro de una tarjeta con
// borde. De arriba hacia abajo: fila de valor editable (−/+ y dos campos de
// texto "H h MM min", con anuncio accesible aparte), un slider no lineal
// (`DURATION_STOPS`, en minutos, con paso fino al principio y cada vez más
// grueso para no tener que arrastrar eternamente para llegar a 6-8 h),
// marcas de referencia bajo el slider y unos chips de atajos comunes.
// Trabaja en minutos "puertas adentro" y solo convierte a horas (2
// decimales, lo que soporta `estimated_hours`) al notificar el cambio.

import { useEffect, useState } from "react";
import {
  DURATION_STOPS,
  hoursToMinutes,
  minutesToHours,
  formatDuration,
  nearestDurationStopIndex,
} from "../lib/subtask-display";
import { cn } from "../lib/utils";

interface HoursPickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

const CHIP_MINUTES = [15, 30, 60, 120, 240, 480];
const MIN_MINUTES = 5;
const MAX_MINUTES = 24 * 60;
const STEP_MINUTES = 5;
// Sin valor todavía, el slider arranca visualmente en 1 h (aunque el
// anuncio siga diciendo "Sin definir" hasta que el usuario interactúe: ver
// `value` en el render de abajo, que no depende de esta posición del thumb).
const DEFAULT_MINUTES = 60;

// Marcas de referencia bajo el slider; puramente decorativas (aria-hidden),
// posicionadas por el índice real de cada minuto dentro de DURATION_STOPS
// (la escala no es lineal, así que no se puede repartir en % parejos). La
// primera y la última se anclan a los bordes (sin centrar) para no desbordar.
const TICKS: Array<{ minutes: number; label: string }> = [
  { minutes: 5, label: "5 min" },
  { minutes: 60, label: "1 h" },
  { minutes: 240, label: "4 h" },
  { minutes: 480, label: "8 h" },
  { minutes: 720, label: "12 h" },
  { minutes: 1440, label: "24 h" },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a] focus-visible:outline-offset-2";

export function HoursPicker({ id, value, onChange, invalid = false, describedBy }: HoursPickerProps) {
  const currentMinutes = value ? hoursToMinutes(value) : null;
  const thumbMinutes = currentMinutes ?? DEFAULT_MINUTES;
  const thumbIndex = nearestDurationStopIndex(thumbMinutes);
  const progressPercent = (thumbIndex / (DURATION_STOPS.length - 1)) * 100;

  // Campos de texto editables (horas/minutos): estado local propio para
  // poder escribir libremente (ej. borrar y volver a escribir) sin que cada
  // tecla intente convertirse en un `estimated_hours` válido. Se sincronizan
  // con `value` cuando cambia desde afuera (chip, stepper, slider, o un
  // reset del formulario) y solo se confirman al perder el foco o con Enter.
  const [hoursDraft, setHoursDraft] = useState("");
  const [minutesDraft, setMinutesDraft] = useState("");

  useEffect(() => {
    if (currentMinutes === null) {
      setHoursDraft("");
      setMinutesDraft("");
      return;
    }
    setHoursDraft(String(Math.floor(currentMinutes / 60)));
    setMinutesDraft(String(currentMinutes % 60).padStart(2, "0"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentMinutes se deriva de `value`; re-sincronizar solo cuando cambia el valor externo.
  }, [value]);

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

  function handleSliderChange(event: React.ChangeEvent<HTMLInputElement>) {
    const index = Number(event.target.value);
    const stopMinutes = DURATION_STOPS[index] ?? DURATION_STOPS[0];
    onChange(minutesToHours(stopMinutes));
  }

  function onlyDigits(raw: string): string {
    return raw.replace(/\D/g, "").slice(0, 2);
  }

  // Confirma horas+minutos escritos a mano: los campos vacíos cuentan como 0,
  // el total se redondea al múltiplo de 5 min más cercano (58 min → 1 h, no
  // se trunca a 55) y se recorta entre 5 min y 24 h; 0 sube a 5 min.
  function commitDraft() {
    const rawHours = hoursDraft === "" ? 0 : Number(hoursDraft);
    const rawMinutes = minutesDraft === "" ? 0 : Number(minutesDraft);
    const hours = Number.isFinite(rawHours) ? rawHours : 0;
    const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
    const roundedTotal = Math.round((hours * 60 + minutes) / STEP_MINUTES) * STEP_MINUTES;
    onChange(minutesToHours(Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, roundedTotal))));
  }

  // Enter confirma sin enviar el formulario: solo quita el foco y el onBlur
  // hace el commit (llamarlo también acá lo duplicaba).
  function handleFieldKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
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
      className="flex flex-col gap-3 rounded-xl border border-[#d4d5d7] p-3"
    >
      {/* Fila de valor: −, "H h MM min" editable, +. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => step(-STEP_MINUTES)}
          disabled={!canDecrement}
          aria-label="Restar 5 minutos"
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d4d5d7] font-jost text-[16px] text-[#4a5565] transition-colors duration-200 disabled:opacity-40",
            focusRing
          )}
        >
          −
        </button>

        <div className="flex items-center gap-1 font-jost text-[20px] text-[#1e2939]">
          <input
            type="text"
            inputMode="numeric"
            aria-label="Horas"
            placeholder="0"
            value={hoursDraft}
            onChange={(event) => setHoursDraft(onlyDigits(event.target.value))}
            onBlur={commitDraft}
            onKeyDown={handleFieldKeyDown}
            className={cn(
              "w-11 rounded-lg border border-[#d4d5d7] py-1 text-center text-[20px]",
              focusRing
            )}
          />
          <span>h</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Minutos"
            placeholder="00"
            value={minutesDraft}
            onChange={(event) => setMinutesDraft(onlyDigits(event.target.value))}
            onBlur={commitDraft}
            onKeyDown={handleFieldKeyDown}
            className={cn(
              "w-11 rounded-lg border border-[#d4d5d7] py-1 text-center text-[20px]",
              focusRing
            )}
          />
          <span>min</span>
        </div>

        <button
          type="button"
          onClick={() => step(STEP_MINUTES)}
          disabled={!canIncrement}
          aria-label="Sumar 5 minutos"
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d4d5d7] font-jost text-[16px] text-[#4a5565] transition-colors duration-200 disabled:opacity-40",
            focusRing
          )}
        >
          +
        </button>
      </div>

      {/* Anuncio accesible: no se ve (los campos de arriba ya muestran el
          valor), pero avisa a lectores de pantalla el valor legible. */}
      <span role="status" aria-live="polite" className="sr-only">
        {value ? formatDuration(value) : "Sin definir"}
      </span>

      {/* Slider no lineal: se mueve sobre el ÍNDICE de DURATION_STOPS. */}
      <div className="flex min-h-11 items-center">
        <input
          type="range"
          min={0}
          max={DURATION_STOPS.length - 1}
          step={1}
          value={thumbIndex}
          onChange={handleSliderChange}
          aria-label="Duración estimada"
          // Anuncia el valor real, no el stop donde se posa el thumb (2 h 35 min
          // se posa en 2 h 30 min pero sigue valiendo 2 h 35 min).
          aria-valuetext={value ? formatDuration(value) : "Sin definir"}
          style={{ "--range-progress": `${progressPercent}%` } as React.CSSProperties}
          className={cn("hours-picker-slider w-full accent-[#8b1a1a]", focusRing)}
        />
      </div>

      <div className="relative h-4" aria-hidden="true">
        {TICKS.map((tick, index) => {
          const isLast = index === TICKS.length - 1;
          const leftPercent = (DURATION_STOPS.indexOf(tick.minutes) / (DURATION_STOPS.length - 1)) * 100;
          return (
            <span
              key={tick.minutes}
              style={isLast ? { right: 0 } : { left: `${leftPercent}%` }}
              className={cn(
                "absolute font-source text-[11px] text-[#99a1af]",
                index > 0 && !isLast && "-translate-x-1/2"
              )}
            >
              {tick.label}
            </span>
          );
        })}
      </div>

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
                "min-h-[44px] rounded-full border px-3 font-jost text-[12px] transition-colors duration-200",
                pressed
                  ? "border-[#8b1a1a] bg-[#8b1a1a] text-white"
                  : "border-[#d4d5d7] text-[#4a5565] hover:bg-[#fff0f0]",
                focusRing
              )}
            >
              {formatDuration(minutesToHours(minutes))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
