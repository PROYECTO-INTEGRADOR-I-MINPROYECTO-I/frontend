// Formulario de creación de gestión (subtarea) dentro de un evento
// (PIM1-27). Mismo patrón que EventFormModal: react-hook-form (mode onBlur,
// shouldFocusError) + applyFieldErrors + banner de red con Reintentar.

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { apiFetch, ApiError } from "../lib/api";
import { applyFieldErrors } from "../lib/form-errors";
import { isoDateTimeToLocalDateString } from "../lib/dates";
import { PRIORITY_LABELS } from "../lib/subtask-display";
import type { Category, CreateSubtaskPayload, Priority, Subtask } from "../lib/types";
import { Modal } from "./modal";
import { CreatableSelect, type SelectOption } from "./creatable-select";
import { cn } from "../lib/utils";

interface SubtaskFormModalProps {
  eventId: number;
  eventName: string;
  /** `Event.due_date` (ISO datetime, no solo fecha) para el aviso de "posterior al evento". */
  eventDueDate?: string;
  onClose: () => void;
  onCreated: (subtask: Subtask, warnings?: string[]) => void;
}

interface SubtaskFormValues {
  title: string;
  categoryId: string;
  scheduled_date: string;
  estimated_hours: string;
  priority: Priority;
  description: string;
}

const EMPTY_VALUES: SubtaskFormValues = {
  title: "",
  categoryId: "",
  scheduled_date: "",
  estimated_hours: "",
  priority: "medium",
  description: "",
};

// Respaldo mientras GET /categorias/ no existe en el backend (hoy 404): las
// 7 categorías predefinidas del ticket. `category` en Subtask es texto
// libre, así que el id de cada opción es directamente su nombre.
const CATEGORY_FALLBACKS: SelectOption[] = [
  "Lugar",
  "Catering",
  "Invitaciones",
  "Proveedores",
  "Logística técnica",
  "Personal/Conferencistas",
  "Marketing",
].map((name) => ({ id: name, name }));

const PRIORITY_DOT_COLOR: Record<Priority, string> = {
  low: "#00d492",
  medium: "#ffb900",
  high: "#8b1a1a",
  urgent: "#da1515",
};

const KNOWN_FIELDS = [
  "title",
  "categoryId",
  "scheduled_date",
  "estimated_hours",
  "priority",
  "description",
] as const;

// El backend nombra el campo "category"; el formulario lo maneja como
// "categoryId" (mismo nombre que usa CreatableSelect en EventFormModal).
function remapSubtaskErrorFields(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const fields: Record<string, string> = {};
  for (const [key, message] of Object.entries(error.fields)) {
    if (key === "category") fields.categoryId = message;
    else fields[key] = message;
  }
  return new ApiError(error.message, error.status, error.code, fields);
}

export function SubtaskFormModal({ eventId, eventName, eventDueDate, onClose, onCreated }: SubtaskFormModalProps) {
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SubtaskFormValues>({ mode: "onBlur", shouldFocusError: true, defaultValues: EMPTY_VALUES });

  useEffect(() => {
    let cancelled = false;
    apiFetch<Category[]>("/categorias/")
      .then((data) => {
        if (!cancelled) setCategories(data.map((category) => ({ id: category.id, name: category.name })));
      })
      .catch(() => {
        if (!cancelled) setCategories(CATEGORY_FALLBACKS);
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function createCategory(name: string): Promise<SelectOption> {
    try {
      const created = await apiFetch<Category>("/categorias/", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      return { id: created.id, name: created.name };
    } catch (err) {
      // El endpoint de categorías todavía no existe en el backend (404): la
      // categoría se agrega solo en esta sesión (no persiste) y se envía
      // como texto libre en el campo `category` al crear la gestión.
      if (err instanceof ApiError && err.status === 404) {
        return { id: name, name };
      }
      throw err;
    }
  }

  const scheduledDate = useWatch({ control, name: "scheduled_date" });
  const priority = useWatch({ control, name: "priority" });
  const eventDueLocalDate = eventDueDate ? isoDateTimeToLocalDateString(eventDueDate) : null;
  // Comparación como texto: "YYYY-MM-DD" ya ordena cronológicamente.
  const dateAfterEventDue = Boolean(eventDueLocalDate && scheduledDate && scheduledDate > eventDueLocalDate);

  async function submit(values: SubtaskFormValues) {
    setApiError(null);
    const payload: CreateSubtaskPayload = {
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.categoryId,
      estimated_hours: String(Number(values.estimated_hours)),
      scheduled_date: values.scheduled_date,
      status: "pending",
      priority: values.priority,
    };

    try {
      const created = await apiFetch<Subtask & { warnings?: string[] }>(`/eventos/${eventId}/subtareas/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const { warnings, ...subtask } = created;
      onCreated(subtask, warnings);
    } catch (err) {
      const remapped = remapSubtaskErrorFields(err);
      const painted = applyFieldErrors(remapped, setError, KNOWN_FIELDS);
      if (!painted) {
        setApiError(
          err instanceof ApiError ? err : new ApiError("Ocurrió un error inesperado. Intenta de nuevo.", 0, "UNKNOWN")
        );
      }
    }
  }

  function handleClose() {
    if (isDirty) {
      const confirmed = window.confirm("Tienes cambios sin guardar. ¿Deseas cerrar de todos modos?");
      if (!confirmed) return;
    }
    onClose();
  }

  function retry() {
    handleSubmit(submit)();
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title="Nueva gestión"
      chips={[{ label: eventName }]}
    >
      <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        {apiError && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg bg-[#fff0f0] p-3 text-[13px] text-[#8b1a1a]">
            <span>{apiError.message}</span>
            <button type="button" onClick={retry} className="w-fit font-jost text-[12px] underline">
              Reintentar
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="subtask-title" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
            Nombre
          </label>
          <input
            id="subtask-title"
            type="text"
            aria-required="true"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "subtask-title-error" : undefined}
            className={cn(
              "h-8 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
              errors.title && "border-red-600"
            )}
            {...register("title", {
              required: "Escribe el nombre de la gestión.",
              validate: (value) => value.trim().length > 0 || "Escribe el nombre de la gestión.",
            })}
          />
          {errors.title && (
            <p id="subtask-title-error" role="alert" className="text-[12px] text-red-600">
              {errors.title.message}
            </p>
          )}
        </div>

        <Controller
          name="categoryId"
          control={control}
          rules={{ required: "Elige una categoría." }}
          render={({ field }) => (
            <CreatableSelect
              id="subtask-category"
              label="Categoría"
              required
              options={categories}
              loading={categoriesLoading}
              value={field.value || null}
              onChange={(value) => field.onChange(String(value))}
              onBlur={field.onBlur}
              error={errors.categoryId?.message}
              createLabel="Crear categoría personalizada"
              onCreate={createCategory}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="subtask-date" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
              Fecha objetivo
            </label>
            <input
              id="subtask-date"
              type="date"
              aria-required="true"
              aria-invalid={Boolean(errors.scheduled_date)}
              aria-describedby={
                cn(errors.scheduled_date && "subtask-date-error", dateAfterEventDue && "subtask-date-warning") ||
                undefined
              }
              className={cn(
                "h-8 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
                errors.scheduled_date && "border-red-600"
              )}
              {...register("scheduled_date", { required: "Indica la fecha objetivo." })}
            />
            {errors.scheduled_date && (
              <p id="subtask-date-error" role="alert" className="text-[12px] text-red-600">
                {errors.scheduled_date.message}
              </p>
            )}
            {!errors.scheduled_date && dateAfterEventDue && (
              <p id="subtask-date-warning" role="status" className="text-[12px] text-[#bb4d00]">
                La fecha objetivo es posterior a la fecha del evento.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="subtask-hours" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
              Horas estimadas
            </label>
            <input
              id="subtask-hours"
              type="number"
              step={0.5}
              inputMode="decimal"
              aria-required="true"
              aria-invalid={Boolean(errors.estimated_hours)}
              aria-describedby={errors.estimated_hours ? "subtask-hours-error" : undefined}
              className={cn(
                "h-8 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
                errors.estimated_hours && "border-red-600"
              )}
              {...register("estimated_hours", {
                required: "Indica las horas estimadas.",
                validate: (value) => Number(value) > 0 || "Las horas estimadas deben ser mayores a 0.",
              })}
            />
            {errors.estimated_hours && (
              <p id="subtask-hours-error" role="alert" className="text-[12px] text-red-600">
                {errors.estimated_hours.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-[#f3f4f6] pt-4">
          <label htmlFor="subtask-priority" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
            Prioridad
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2 h-2 w-2 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: PRIORITY_DOT_COLOR[priority] }}
            />
            <select
              id="subtask-priority"
              className="h-8 w-full appearance-none rounded-lg border border-[#d4d5d7] pr-8 pl-6 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
              {...register("priority")}
            >
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#99a1af]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-[#f3f4f6] pt-4">
          <label
            htmlFor="subtask-description"
            className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase"
          >
            Descripción
          </label>
          <textarea
            id="subtask-description"
            rows={3}
            className="min-h-[54px] rounded-lg border border-[#d4d5d7] px-2 py-1 font-source text-[14px] leading-[22.75px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
            {...register("description")}
          />
        </div>

        <div className="flex gap-3 border-t border-[#f3f4f6] pt-4">
          <button
            type="button"
            onClick={handleClose}
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
            {isSubmitting ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
