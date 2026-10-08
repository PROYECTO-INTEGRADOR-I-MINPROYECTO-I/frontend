// Wizard de conflicto de sobrecarga diaria (Sprint 3, C3/C4), por encima del
// form de reprogramación o edición que lo disparó (mismo patrón de overlay
// centrado que ConfirmDialog, pero con 2 stages en vez de un solo paso: no
// usa WizardStageIndicator porque es estrictamente lineal, sin volver a una
// stage ya vista ni saltar entre ellas).
//
// Stage 1 (informativa): cifras exactas de la sobrecarga.
// Stage 2 (resolución): "mover" y "reducir horas" como toggles excluyentes
// entre sí; "Ir atrás" vuelve directo al form original (no a la stage 1,
// así lo pidió el equipo), "Confirmar" solo aplica la resolución elegida al
// campo del form original — no guarda nada por su cuenta.
//
// El estado interno (stage, selección) no se reinicia con un efecto: quien
// abre el wizard le pasa un `key` que cambia por cada conflicto nuevo (ver
// reprogram-modal.tsx), así que React lo remonta limpio en vez de arrastrar
// la stage/selección de un conflicto anterior.

import { useEffect, useRef, useState } from "react";
import { formatShortDateEs } from "../lib/dates";
import { formatPlainHours, type ConflictInfo } from "../lib/daily-capacity";
import { cn } from "../lib/utils";

export type ConflictResolution = { type: "move"; date: string } | { type: "reduce"; hours: number };

interface OverloadConflictWizardProps {
  open: boolean;
  conflict: ConflictInfo | null;
  /** Ya calculada por quien abre el wizard (ver daily-capacity.ts): null si ningún día del rango tiene capacidad. */
  moveSuggestion: string | null;
  /** Ya calculado por quien abre el wizard: null si el día ya está en el límite aunque se reduzca esta gestión a 0. */
  maxReduceHours: number | null;
  onBack: () => void;
  onConfirm: (resolution: ConflictResolution) => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function OverloadConflictWizard({
  open,
  conflict,
  moveSuggestion,
  maxReduceHours,
  onBack,
  onConfirm,
}: OverloadConflictWizardProps) {
  const [stage, setStage] = useState<0 | 1>(0);
  const [selected, setSelected] = useState<ConflictResolution | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onBackRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const list = Array.from(focusable);
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [open]);

  if (!open || !conflict) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBack();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="overload-wizard-title"
        className="w-full max-w-[420px] rounded-[10px] bg-white p-5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] sm:p-6"
      >
        {stage === 0 ? (
          <div className="flex flex-col gap-3">
            <h2 id="overload-wizard-title" className="font-jost text-[18px] leading-[23px] text-[#8b1a1a]">
              ¡Esta reprogramación supera tu límite diario!
            </h2>
            <dl className="flex flex-col gap-2 rounded-lg bg-[#fff0f0] p-3 font-source text-[14px] text-[#1e2939]">
              <div className="flex justify-between gap-3">
                <dt className="text-[#4a5565]">Día</dt>
                <dd>{formatShortDateEs(conflict.date)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#4a5565]">Horas programadas para ese día</dt>
                <dd>{formatPlainHours(conflict.existingHours)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-[#f3d9d9] pt-2">
                <dt className="text-[#4a5565]">Horas con esta gestión</dt>
                <dd className="font-jost text-[#8b1a1a]">
                  {formatPlainHours(conflict.plannedHours)} <span className="text-[#4a5565]">/ límite {formatPlainHours(conflict.limit)}</span>
                </dd>
              </div>
            </dl>
            <div className="mt-2 flex justify-between gap-3">
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-[0.635px] border-[#8b1a1a] px-4 py-[10px] font-jost text-[14px] text-[#8b1a1a]"
              >
                Ir atrás
              </button>
              <button
                type="button"
                onClick={() => setStage(1)}
                className="rounded-lg bg-[#8b1a1a] px-4 py-[10px] font-jost text-[14px] text-white"
              >
                Ver opciones de solución
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 id="overload-wizard-title" className="font-jost text-[18px] leading-[23px] text-[#1e2939]">
              ¿Cómo quieres resolverlo?
            </h2>

            <ResolutionToggle
              label={moveSuggestion ? `Opción 1: Reprogramar para ${formatShortDateEs(moveSuggestion)}` : undefined}
              disabledLabel={
                moveSuggestion
                  ? undefined
                  : "No encontramos un día disponible entre hoy y la fecha del evento."
              }
              pressed={selected?.type === "move"}
              onToggle={() =>
                setSelected((prev) =>
                  prev?.type === "move" ? null : moveSuggestion ? { type: "move", date: moveSuggestion } : null
                )
              }
            />

            <ResolutionToggle
              label={
                maxReduceHours !== null
                  ? `Opción 2: Reducir duración de la gestión a ${formatPlainHours(maxReduceHours)}`
                  : undefined
              }
              disabledLabel={
                maxReduceHours !== null
                  ? undefined
                  : "El día al que planeas ya está en su límite diario. No caben más gestiones."
              }
              pressed={selected?.type === "reduce"}
              onToggle={() =>
                setSelected((prev) =>
                  prev?.type === "reduce"
                    ? null
                    : maxReduceHours !== null
                      ? { type: "reduce", hours: maxReduceHours }
                      : null
                )
              }
            />

            <div className="mt-2 flex justify-between gap-3">
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-[0.635px] border-[#8b1a1a] px-4 py-[10px] font-jost text-[14px] text-[#8b1a1a]"
              >
                Ir atrás
              </button>
              <button
                type="button"
                disabled={!selected}
                onClick={() => selected && onConfirm(selected)}
                className="rounded-lg bg-[#8b1a1a] px-4 py-[10px] font-jost text-[14px] text-white disabled:opacity-60"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResolutionToggle({
  label,
  disabledLabel,
  pressed,
  onToggle,
}: {
  label?: string;
  disabledLabel?: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  if (!label) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] p-3 opacity-60">
        <p role="alert" className="font-source text-[13px] text-[#8b1a1a]">
          {disabledLabel}
        </p>
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 rounded-lg border p-3 text-left font-source text-[14px] transition-colors duration-150",
        pressed ? "border-[#8b1a1a] bg-[#fff0f0] text-[#1e2939]" : "border-[#d4d5d7] text-[#1e2939] hover:bg-[#f9fafb]"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
          pressed ? "border-[#8b1a1a] bg-[#8b1a1a] text-white" : "border-[#d4d5d7]"
        )}
      >
        {pressed && "✓"}
      </span>
      {label}
    </button>
  );
}
