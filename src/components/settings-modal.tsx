// Configuración del límite diario de horas (Sprint 3 / C2 / PIM1-9): valor
// por defecto 6h, rango 1-16h, validado en el input (min/max/step) y
// reforzado por el backend. Se abre desde AccountMenu.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError, updateUserSettings } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Modal } from "./modal";
import { cn } from "../lib/utils";

interface SettingsModalProps {
  onClose: () => void;
}

interface SettingsFormValues {
  max_daily_hours: string;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { user, updateUser } = useAuth();
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    defaultValues: { max_daily_hours: user?.max_daily_hours ?? "6.00" },
  });

  async function submit(values: SettingsFormValues) {
    setApiError(null);
    setSaved(false);
    try {
      const updated = await updateUserSettings(values.max_daily_hours);
      updateUser({ max_daily_hours: updated.max_daily_hours });
      setSaved(true);
    } catch (err) {
      setApiError(
        err instanceof ApiError ? err : new ApiError("Ocurrió un error inesperado. Intenta de nuevo.", 0, "UNKNOWN")
      );
    }
  }

  function retry() {
    handleSubmit(submit)();
  }

  return (
    <Modal open onClose={onClose} title="Configuración">
      <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        {apiError && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg bg-[#fff0f0] p-3 text-[13px] text-[#8b1a1a]">
            <span>{apiError.message}</span>
            <button type="button" onClick={retry} className="w-fit font-jost text-[12px] underline">
              Reintentar
            </button>
          </div>
        )}

        {saved && !apiError && (
          <p role="status" className="rounded-lg bg-[#ecfdf5] p-3 text-[13px] text-[#007a55]">
            Límite diario actualizado.
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="settings-max-hours"
            className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase"
          >
            Límite diario de horas de gestión
          </label>
          <input
            id="settings-max-hours"
            type="number"
            min={1}
            max={16}
            step={0.5}
            aria-required="true"
            aria-invalid={Boolean(errors.max_daily_hours)}
            aria-describedby={cn("settings-max-hours-help", errors.max_daily_hours && "settings-max-hours-error")}
            className={cn(
              "h-8 w-28 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
              errors.max_daily_hours && "border-red-600"
            )}
            {...register("max_daily_hours", {
              required: "Indica tu límite diario.",
              validate: (value) => {
                const num = Number(value);
                if (!Number.isFinite(num)) return "Indica tu límite diario.";
                if (num < 1 || num > 16) return "El límite debe estar entre 1 y 16 horas.";
                return true;
              },
            })}
          />
          <p id="settings-max-hours-help" className="font-source text-[12px] text-[#99a1af]">
            Entre 1 y 16 horas al día. Por defecto, 6 horas.
          </p>
          {errors.max_daily_hours && (
            <p id="settings-max-hours-error" role="alert" className="text-[12px] text-red-600">
              {errors.max_daily_hours.message}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-[#f3f4f6] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[0.635px] border-[#8b1a1a] py-[10px] font-jost text-[14px] text-[#8b1a1a]"
          >
            Cerrar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="flex-1 rounded-lg bg-[#8b1a1a] py-[10px] font-jost text-[14px] text-white disabled:opacity-60"
          >
            {isSubmitting ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
