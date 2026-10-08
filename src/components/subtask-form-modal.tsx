// Formulario de creación de gestión (subtarea) dentro de un evento
// (PIM1-27). Mismo patrón que EventFormModal: react-hook-form (mode onBlur,
// shouldFocusError) + applyFieldErrors + banner de red con Reintentar.

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { apiFetch, ApiError, createSubtask } from "../lib/api";
import { applyFieldErrors } from "../lib/form-errors";
import { formatShortDateEs, isoDateTimeToLocalDateString, todayLocalDateString } from "../lib/dates";
import { checkOverloadConflict, type ConflictInfo } from "../lib/daily-capacity";
import type { Category, CreateSubtaskPayload, Subtask, UpdateSubtaskPayload } from "../lib/types";
import { Modal } from "./modal";
import { ConfirmDialog } from "./confirm-dialog";
import { CreatableSelect, type SelectOption } from "./creatable-select";
import { HoursPicker } from "./hours-picker";
import { OverloadConflictWizard, type ConflictResolution } from "./overload-conflict-wizard";
import { cn } from "../lib/utils";

interface SubtaskFormModalProps {
  eventId: number;
  eventName: string;
  /** `Event.due_date` (ISO datetime, no solo fecha) para el aviso de "posterior al evento" y el tope de la sugerencia de "mover" (C4). */
  eventDueDate?: string;
  /** Límite diario del organizador (Sprint 3 / C3): sin esto no hay cómo predecir conflicto al crear/editar fecha u horas. */
  maxDailyHours?: string;
  /** Presente en modo edición: precarga el formulario y hace PATCH en vez de POST. */
  initialValues?: Subtask;
  onClose: () => void;
  onCreated?: (subtask: Subtask, warnings?: string[]) => void;
  onUpdated?: (subtask: Subtask) => void;
}

interface SubtaskFormValues {
  title: string;
  categoryId: string;
  scheduled_date: string;
  estimated_hours: string;
  description: string;
}

const EMPTY_VALUES: SubtaskFormValues = {
  title: "",
  categoryId: "",
  scheduled_date: "",
  estimated_hours: "",
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

const KNOWN_FIELDS = [
  "title",
  "categoryId",
  "scheduled_date",
  "estimated_hours",
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

function subtaskFormDefaultValues(subtask?: Subtask): SubtaskFormValues {
  if (!subtask) return EMPTY_VALUES;
  return {
    title: subtask.title,
    categoryId: subtask.category,
    scheduled_date: subtask.scheduled_date,
    estimated_hours: subtask.estimated_hours,
    description: subtask.description,
  };
}

// Solo los campos que cambiaron (dirtyFields de react-hook-form).
function buildSubtaskUpdatePayload(
  values: SubtaskFormValues,
  dirtyFields: Partial<Record<keyof SubtaskFormValues, boolean>>
): UpdateSubtaskPayload {
  const payload: UpdateSubtaskPayload = {};
  if (dirtyFields.title) payload.title = values.title.trim();
  if (dirtyFields.description) payload.description = values.description.trim();
  if (dirtyFields.categoryId) payload.category = values.categoryId;
  if (dirtyFields.estimated_hours) payload.estimated_hours = String(Number(values.estimated_hours));
  if (dirtyFields.scheduled_date) payload.scheduled_date = values.scheduled_date;
  return payload;
}

export function SubtaskFormModal({
  eventId,
  eventName,
  eventDueDate,
  maxDailyHours,
  initialValues,
  onClose,
  onCreated,
  onUpdated,
}: SubtaskFormModalProps) {
  const mode = initialValues ? "edit" : "create";

  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  // PIM1-110: valores en espera de confirmación cuando scheduled_date ya venció.
  // No basta con el mensaje inline (el profesor lo pasó por alto en la clínica
  // de Sprint 1); esto interrumpe el guardado con un popup que no se puede ignorar.
  const [pendingPastDateValues, setPendingPastDateValues] = useState<SubtaskFormValues | null>(null);
  // Sprint 3 / C3: conflicto de sobrecarga predicho al editar fecha u horas
  // (el PATCH genérico nunca bloquea por su cuenta, a diferencia de
  // /subtareas/<id>/reprogram/ — ver reprogram-modal.tsx). wizardKey sube en
  // cada conflicto nuevo para que OverloadConflictWizard remonte limpio.
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [moveSuggestion, setMoveSuggestion] = useState<string | null>(null);
  const [maxReduce, setMaxReduce] = useState<number | null>(null);
  const [wizardKey, setWizardKey] = useState(0);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<SubtaskFormValues>({
    mode: "onBlur",
    shouldFocusError: true,
    defaultValues: subtaskFormDefaultValues(initialValues),
  });

  // Igual que con el tipo de evento: si la categoría de la gestión editada no
  // vino en el listado (por ejemplo texto libre creado en otra sesión), se
  // agrega como opción. Acá sí se conoce el nombre real (category es texto
  // libre y coincide con su propio id).
  function withCurrentCategory(list: SelectOption[]): SelectOption[] {
    if (!initialValues) return list;
    const exists = list.some((category) => category.id === initialValues.category);
    if (exists) return list;
    return [...list, { id: initialValues.category, name: initialValues.category }];
  }

  useEffect(() => {
    let cancelled = false;
    apiFetch<Category[]>("/categorias/")
      .then((data) => {
        if (!cancelled) {
          setCategories(withCurrentCategory(data.map((category) => ({ id: category.id, name: category.name }))));
        }
      })
      .catch(() => {
        if (!cancelled) setCategories(withCurrentCategory(CATEGORY_FALLBACKS));
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialValues es estable durante la vida del modal (remonta con key en cada apertura).
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
  const eventDueLocalDate = eventDueDate ? isoDateTimeToLocalDateString(eventDueDate) : null;
  // Comparación como texto: "YYYY-MM-DD" ya ordena cronológicamente.
  const dateAfterEventDue = Boolean(eventDueLocalDate && scheduledDate && scheduledDate > eventDueLocalDate);

  async function submit(values: SubtaskFormValues) {
    // Solo al crear: si ya se está editando una gestión pasada, no interrumpir
    // guardados de otros campos con este popup en cada edición.
    if (mode === "create" && values.scheduled_date < todayLocalDateString()) {
      setPendingPastDateValues(values);
      return;
    }
    await performSubmit(values);
  }

  // Sprint 3 / C3: true si hay conflicto (ya dejó el wizard abierto y no se
  // debe guardar todavía). Si falla la predicción (red caída, etc.), no
  // bloquea: ninguno de los dos guardados de abajo rechaza por sobrecarga
  // por su cuenta, así que solo se deja de avisar con anticipación esta vez.
  async function checkConflictBeforeSaving(
    date: string,
    hours: number,
    excludeSubtaskId?: number
  ): Promise<boolean> {
    if (!maxDailyHours) return false;
    const limit = Number(maxDailyHours);
    if (!Number.isFinite(limit)) return false;

    try {
      const result = await checkOverloadConflict({ date, hours, limit, eventDueDate, excludeSubtaskId });
      if (!result) return false;
      setWizardKey((key) => key + 1);
      setConflict(result.conflict);
      setMoveSuggestion(result.moveSuggestion);
      setMaxReduce(result.maxReduceHours);
      return true;
    } catch {
      return false;
    }
  }

  async function performSubmit(values: SubtaskFormValues) {
    setApiError(null);

    if (mode === "edit" && initialValues) {
      if (!isDirty) {
        onClose();
        return;
      }
      const payload = buildSubtaskUpdatePayload(values, dirtyFields);
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }

      if (payload.scheduled_date || payload.estimated_hours) {
        const date = payload.scheduled_date ?? initialValues.scheduled_date;
        const hours = Number(payload.estimated_hours ?? initialValues.estimated_hours);
        if (await checkConflictBeforeSaving(date, hours, initialValues.subtask_id)) return;
      }

      try {
        const updated = await apiFetch<Subtask>(`/subtareas/${initialValues.subtask_id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onUpdated?.(updated);
      } catch (err) {
        const remapped = remapSubtaskErrorFields(err);
        const painted = applyFieldErrors(remapped, setError, KNOWN_FIELDS);
        if (!painted) {
          setApiError(
            err instanceof ApiError ? err : new ApiError("Ocurrió un error inesperado. Intenta de nuevo.", 0, "UNKNOWN")
          );
        }
      }
      return;
    }

    if (await checkConflictBeforeSaving(values.scheduled_date, Number(values.estimated_hours))) return;

    const payload: CreateSubtaskPayload = {
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.categoryId,
      estimated_hours: String(Number(values.estimated_hours)),
      scheduled_date: values.scheduled_date,
      status: "pending",
    };

    try {
      const created = await createSubtask(eventId, payload);
      const { warnings, ...subtask } = created;
      onCreated?.(subtask, warnings);
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

  function handleResolution(resolution: ConflictResolution) {
    if (resolution.type === "move") {
      setValue("scheduled_date", resolution.date, { shouldDirty: true });
    } else {
      setValue("estimated_hours", String(resolution.hours), { shouldDirty: true });
    }
    setConflict(null);
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={mode === "edit" ? "Editar gestión" : "Nueva gestión"}
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

        <div className="grid grid-cols-1 gap-4">
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
            {/* No es un <label htmlFor>: "subtask-hours" es el id del grupo
                (role="group", ver HoursPicker), no el de un control de
                formulario nativo, así que htmlFor quedaría roto. El grupo
                se asocia con este texto via aria-labelledby. */}
            <span
              id="subtask-hours-label"
              className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase"
            >
              Horas estimadas
            </span>
            <Controller
              name="estimated_hours"
              control={control}
              rules={{
                required: "Indica las horas estimadas.",
                validate: (value) => Number(value) > 0 || "Las horas estimadas deben ser mayores a 0.",
              }}
              render={({ field }) => (
                <HoursPicker
                  id="subtask-hours"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.estimated_hours)}
                  describedBy={errors.estimated_hours ? "subtask-hours-error" : undefined}
                />
              )}
            />
            {errors.estimated_hours && (
              <p id="subtask-hours-error" role="alert" className="text-[12px] text-red-600">
                {errors.estimated_hours.message}
              </p>
            )}
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

        <div className="flex flex-wrap gap-3 border-t border-[#f3f4f6] pt-4">
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

      <ConfirmDialog
        open={pendingPastDateValues !== null}
        title="Esta gestión ya está vencida"
        description={
          pendingPastDateValues
            ? `La fecha objetivo (${formatShortDateEs(pendingPastDateValues.scheduled_date)}) ya pasó. Puedes crearla de todos modos o volver a elegir la fecha.`
            : ""
        }
        confirmLabel="Crear de todos modos"
        cancelLabel="Cambiar fecha"
        onConfirm={() => {
          const values = pendingPastDateValues;
          setPendingPastDateValues(null);
          if (values) void performSubmit(values);
        }}
        onCancel={() => setPendingPastDateValues(null)}
      />

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
