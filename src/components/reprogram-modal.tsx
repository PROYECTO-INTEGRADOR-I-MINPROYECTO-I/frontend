// "Reprogramar" (Sprint 3 / C1): popup chico, un solo stage, con la fecha a
// la izquierda y la duración a la derecha (reutiliza los mismos campos del
// Wizard de creación), ambos precargados con el valor actual de la gestión.
// Guarda con el mismo PATCH /subtareas/<id>/ que ya usa "Editar gestión" (no
// el endpoint dedicado /reprogram/, que solo acepta fecha: acá también se
// puede ajustar la duración en el mismo paso, así que conviene un solo PATCH
// atómico con los dos campos en vez de dos llamadas separadas).
//
// Antes de guardar, se predice el conflicto de sobrecarga en el cliente (ver
// lib/daily-capacity.ts): si lo hay, se abre el wizard de resolución
// (C3/C4) en vez de guardar. "Confirmar" en ese wizard solo actualiza los
// campos de este form; el organizador vuelve a pulsar "Reprogramar" para
// guardar de verdad, ya sin conflicto.

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { apiFetch, ApiError } from "../lib/api";
import {
  addDaysToLocalDate,
  daysBetweenLocalDates,
  isoDateTimeToLocalDateString,
  todayLocalDateString,
} from "../lib/dates";
import {
  fetchDailyCapacity,
  findMoveSuggestion,
  maxReducibleHours,
  predictConflict,
  type ConflictInfo,
} from "../lib/daily-capacity";
import type { Subtask, SubtaskWithConflict } from "../lib/types";
import { Modal } from "./modal";
import { HoursPicker } from "./hours-picker";
import { OverloadConflictWizard, type ConflictResolution } from "./overload-conflict-wizard";
import { cn } from "../lib/utils";

interface ReprogramModalProps {
  subtask: Subtask;
  eventName: string;
  /** `Event.due_date` (ISO datetime): tope del rango que explora la sugerencia de "mover" (C4). */
  eventDueDate?: string;
  /** Límite diario del organizador (`User.max_daily_hours`): sin esto no hay cómo predecir conflicto. */
  maxDailyHours?: string;
  onClose: () => void;
  onReprogrammed: (subtask: Subtask) => void;
}

interface ReprogramFormValues {
  scheduled_date: string;
  estimated_hours: string;
}

// Tope por defecto cuando no hay fecha de evento (no debería pasar en la
// práctica, pero el prop es opcional): mismo límite que ya valida el backend
// para `dias_proximos`.
const DEFAULT_WINDOW_DAYS = 60;

export function ReprogramModal({
  subtask,
  eventName,
  eventDueDate,
  maxDailyHours,
  onClose,
  onReprogrammed,
}: ReprogramModalProps) {
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [moveSuggestion, setMoveSuggestion] = useState<string | null>(null);
  const [maxReduce, setMaxReduce] = useState<number | null>(null);
  // Sube en cada conflicto nuevo: fuerza que OverloadConflictWizard remonte
  // limpio (stage 1, sin selección) en vez de arrastrar la stage/selección
  // de un intento anterior.
  const [wizardKey, setWizardKey] = useState(0);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<ReprogramFormValues>({
    defaultValues: {
      scheduled_date: subtask.scheduled_date,
      estimated_hours: subtask.estimated_hours,
    },
  });

  const limit = maxDailyHours ? Number(maxDailyHours) : null;

  async function submit(values: ReprogramFormValues) {
    setApiError(null);

    if (limit !== null && Number.isFinite(limit)) {
      const today = todayLocalDateString();
      const maxDate = eventDueDate
        ? isoDateTimeToLocalDateString(eventDueDate)
        : addDaysToLocalDate(today, DEFAULT_WINDOW_DAYS);
      const windowDays = Math.max(1, daysBetweenLocalDates(today, maxDate));

      try {
        const snapshot = await fetchDailyCapacity(limit, windowDays);
        const predicted = predictConflict(
          snapshot,
          values.scheduled_date,
          Number(values.estimated_hours),
          subtask.subtask_id
        );
        if (predicted) {
          setWizardKey((key) => key + 1);
          setConflict(predicted);
          setMoveSuggestion(
            findMoveSuggestion(
              snapshot,
              predicted.date,
              Number(values.estimated_hours),
              today,
              maxDate,
              subtask.subtask_id
            )
          );
          setMaxReduce(maxReducibleHours(snapshot, predicted.date, subtask.subtask_id));
          return; // No guarda: espera a que el organizador resuelva el conflicto.
        }
      } catch {
        // Si falla la predicción (red caída, etc.), no bloquea el guardado: el
        // PATCH genérico igual nunca rechaza por sobrecarga, solo deja de
        // avisar con anticipación esta vez.
      }
    }

    await performSave(values);
  }

  async function performSave(values: ReprogramFormValues) {
    try {
      const updated = await apiFetch<SubtaskWithConflict>(`/subtareas/${subtask.subtask_id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          scheduled_date: values.scheduled_date,
          estimated_hours: String(Number(values.estimated_hours)),
        }),
      });
      onReprogrammed(updated);
    } catch (err) {
      setApiError(
        err instanceof ApiError ? err : new ApiError("Ocurrió un error inesperado. Intenta de nuevo.", 0, "UNKNOWN")
      );
    }
  }

  function retry() {
    handleSubmit(submit)();
  }

  function handleResolution(resolution: ConflictResolution) {
    if (resolution.type === "move") {
      setValue("scheduled_date", resolution.date, { shouldDirty: true });
    } else {
      setValue("estimated_hours", String(resolution.hours), { shouldDirty: true });
    }
    setConflict(null);
  }

  return (
    <Modal open onClose={onClose} title="Reprogramar gestión" chips={[{ label: eventName }]}>
      <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        {apiError && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg bg-[#fff0f0] p-3 text-[13px] text-[#8b1a1a]">
            <span>{apiError.message}</span>
            <button type="button" onClick={retry} className="w-fit font-jost text-[12px] underline">
              Reintentar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="reprogram-date" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
              Nueva fecha
            </label>
            <Controller
              name="scheduled_date"
              control={control}
              rules={{ required: "Indica la nueva fecha." }}
              render={({ field }) => (
                <input
                  id="reprogram-date"
                  type="date"
                  aria-required="true"
                  aria-invalid={Boolean(errors.scheduled_date)}
                  aria-describedby={errors.scheduled_date ? "reprogram-date-error" : undefined}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  className={cn(
                    "h-8 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
                    errors.scheduled_date && "border-red-600"
                  )}
                />
              )}
            />
            {errors.scheduled_date && (
              <p id="reprogram-date-error" role="alert" className="text-[12px] text-red-600">
                {errors.scheduled_date.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span id="reprogram-hours-label" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
              Nueva duración
            </span>
            <Controller
              name="estimated_hours"
              control={control}
              rules={{
                required: "Indica la duración.",
                validate: (value) => Number(value) > 0 || "La duración debe ser mayor a 0.",
              }}
              render={({ field }) => (
                <HoursPicker
                  id="reprogram-hours"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.estimated_hours)}
                  describedBy={errors.estimated_hours ? "reprogram-hours-error" : undefined}
                />
              )}
            />
            {errors.estimated_hours && (
              <p id="reprogram-hours-error" role="alert" className="text-[12px] text-red-600">
                {errors.estimated_hours.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-[#f3f4f6] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[0.635px] border-[#8b1a1a] py-[10px] font-jost text-[14px] text-[#8b1a1a]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="flex-1 rounded-lg bg-[#8b1a1a] py-[10px] font-jost text-[14px] text-white disabled:opacity-60"
          >
            {isSubmitting ? "Guardando…" : "Reprogramar"}
          </button>
        </div>
      </form>

      <OverloadConflictWizard
        key={wizardKey}
        open={conflict !== null}
        conflict={conflict}
        moveSuggestion={moveSuggestion}
        maxReduceHours={maxReduce}
        onBack={() => setConflict(null)}
        onConfirm={handleResolution}
      />
    </Modal>
  );
}
