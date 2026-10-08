// Wizard de creación de gestión (PIM1-117, primera versión preliminar — ver
// "Correcciones de UI dadas por el profesor durante clínica de sprint 1").
// Misma estructura que EventWizard (intro + stages de campos con círculos
// navegables + X roja/tooltip sobre error de validación), reutilizando
// WizardStageIndicator. La corrección pide explícitamente que las dos vistas
// de creación (evento/gestión) sean "claramente diferenciables": acá se
// logra con el ícono y texto propios de la intro ("¡Vamos a crear una nueva
// gestión para X!", X = el evento) y con el chip del evento dueño en la
// cabecera del modal (el wizard de evento no tiene chip — su título es el
// nombre del evento una vez creado).
//
// Alcance de esta primera versión: solo CREAR (no reemplaza SubtaskFormModal
// en modo edición, que sigue abriéndose igual desde el detalle de una
// gestión). A diferencia de EventWizard, acá no hay una stage siguiente a la
// creación — la gestión se crea en la última stage de campos y el wizard
// cierra de una vez.

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { ChevronLeft, ClipboardList } from "lucide-react";
import { apiFetch, ApiError, createSubtask } from "../lib/api";
import { applyFieldErrors } from "../lib/form-errors";
import { formatShortDateEs, isoDateTimeToLocalDateString, todayLocalDateString } from "../lib/dates";
import { checkOverloadConflict, type ConflictInfo } from "../lib/daily-capacity";
import { ConfirmDialog } from "./confirm-dialog";
import { CreatableSelect, type SelectOption } from "./creatable-select";
import { HoursPicker } from "./hours-picker";
import { Modal } from "./modal";
import { OverloadConflictWizard, type ConflictResolution } from "./overload-conflict-wizard";
import { WizardStageIndicator } from "./wizard-stage-indicator";
import { cn } from "../lib/utils";
import type { Category, CreateSubtaskPayload, Subtask } from "../lib/types";

interface SubtaskWizardProps {
  eventId: number;
  eventName: string;
  /** `Event.due_date` (ISO datetime) para el aviso de "posterior al evento" y el tope de la sugerencia de "mover" (Sprint 3 / C4). */
  eventDueDate?: string;
  /** Límite diario del organizador (Sprint 3 / C3): sin esto no hay cómo predecir conflicto. */
  maxDailyHours?: string;
  onClose: () => void;
  onCreated: (subtask: Subtask, warnings?: string[]) => void;
}

interface SubtaskWizardValues {
  title: string;
  categoryId: string;
  scheduled_date: string;
  estimated_hours: string;
  description: string;
}

const EMPTY_VALUES: SubtaskWizardValues = {
  title: "",
  categoryId: "",
  scheduled_date: "",
  estimated_hours: "",
  description: "",
};

// Mismo respaldo que SubtaskFormModal mientras GET /categorias/ falle.
const CATEGORY_FALLBACKS: SelectOption[] = [
  "Lugar",
  "Catering",
  "Invitaciones",
  "Proveedores",
  "Logística técnica",
  "Personal/Conferencistas",
  "Marketing",
].map((name) => ({ id: name, name }));

type FieldStageKey = "basico" | "fecha" | "detalle";

interface FieldStage {
  key: FieldStageKey;
  label: string;
  fields: (keyof SubtaskWizardValues)[];
}

const FIELD_STAGES: FieldStage[] = [
  { key: "basico", label: "¿Qué gestión es?", fields: ["title", "categoryId"] },
  { key: "fecha", label: "¿Cuándo y cuánto esfuerzo?", fields: ["scheduled_date", "estimated_hours"] },
  { key: "detalle", label: "¿Algo más que agregar?", fields: ["description"] },
];

const INTRO_STAGE = 0;
const TOTAL_STAGES = FIELD_STAGES.length + 1;

function remapSubtaskErrorFields(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const fields: Record<string, string> = {};
  for (const [key, message] of Object.entries(error.fields)) {
    if (key === "category") fields.categoryId = message;
    else fields[key] = message;
  }
  return new ApiError(error.message, error.status, error.code, fields);
}

const KNOWN_FIELDS = ["title", "categoryId", "scheduled_date", "estimated_hours", "description"] as const;

export function SubtaskWizard({
  eventId,
  eventName,
  eventDueDate,
  maxDailyHours,
  onClose,
  onCreated,
}: SubtaskWizardProps) {
  const [stage, setStage] = useState(INTRO_STAGE);
  const [furthest, setFurthest] = useState(INTRO_STAGE);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // PIM1-110: valores en espera de confirmación cuando scheduled_date ya venció.
  const [pendingPastDateValues, setPendingPastDateValues] = useState<SubtaskWizardValues | null>(null);
  // Sprint 3 / C3: conflicto de sobrecarga predicho antes de crear. wizardKey
  // sube en cada conflicto nuevo para que OverloadConflictWizard remonte limpio.
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [moveSuggestion, setMoveSuggestion] = useState<string | null>(null);
  const [maxReduce, setMaxReduce] = useState<number | null>(null);
  const [wizardKey, setWizardKey] = useState(0);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SubtaskWizardValues>({
    mode: "onBlur",
    shouldFocusError: true,
    defaultValues: EMPTY_VALUES,
  });

  function ensureCategoriesLoaded() {
    if (categoriesLoaded) return;
    setCategoriesLoaded(true);
    apiFetch<Category[]>("/categorias/")
      .then((data) => setCategories(data.map((category) => ({ id: category.id, name: category.name }))))
      .catch(() => setCategories(CATEGORY_FALLBACKS))
      .finally(() => setCategoriesLoading(false));
  }

  async function createCategory(name: string): Promise<SelectOption> {
    try {
      const created = await apiFetch<Category>("/categorias/", { method: "POST", body: JSON.stringify({ name }) });
      return { id: created.id, name: created.name };
    } catch (err) {
      // El endpoint de categorías todavía no existe en el backend (404): la
      // categoría se agrega solo en esta sesión, como texto libre.
      if (err instanceof ApiError && err.status === 404) {
        return { id: name, name };
      }
      throw err;
    }
  }

  const scheduledDate = useWatch({ control, name: "scheduled_date" });
  const eventDueLocalDate = eventDueDate ? isoDateTimeToLocalDateString(eventDueDate) : null;
  const dateAfterEventDue = Boolean(eventDueLocalDate && scheduledDate && scheduledDate > eventDueLocalDate);

  function goToStage(index: number) {
    if (index > furthest) return;
    setStage(index);
  }

  async function handleNextFieldStage(stageIndex: number) {
    const fieldStage = FIELD_STAGES[stageIndex - 1];
    const valid = await trigger(fieldStage.fields);
    if (!valid) return;

    if (stageIndex < FIELD_STAGES.length) {
      const next = stageIndex + 1;
      setStage(next);
      setFurthest((f) => Math.max(f, next));
      return;
    }

    // Última stage de campos: acá se crea la gestión de verdad.
    await handleSubmit(submit, onInvalid)();
  }

  function onInvalid(formErrors: typeof errors) {
    const erroredStageIndex = FIELD_STAGES.findIndex((fieldStage) =>
      fieldStage.fields.some((field) => field in formErrors)
    );
    if (erroredStageIndex >= 0) setStage(erroredStageIndex + 1);
  }

  async function submit(values: SubtaskWizardValues) {
    if (values.scheduled_date < todayLocalDateString()) {
      setPendingPastDateValues(values);
      return;
    }
    await performSubmit(values);
  }

  async function performSubmit(values: SubtaskWizardValues) {
    setApiError(null);

    if (maxDailyHours) {
      const limit = Number(maxDailyHours);
      if (Number.isFinite(limit)) {
        try {
          const result = await checkOverloadConflict({
            date: values.scheduled_date,
            hours: Number(values.estimated_hours),
            limit,
            eventDueDate,
          });
          if (result) {
            setWizardKey((key) => key + 1);
            setConflict(result.conflict);
            setMoveSuggestion(result.moveSuggestion);
            setMaxReduce(result.maxReduceHours);
            return; // No crea: espera a que el organizador resuelva el conflicto.
          }
        } catch {
          // Si falla la predicción (red caída, etc.), no bloquea la creación:
          // el backend igual puede rechazar con su propio 409 si corresponde.
        }
      }
    }

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

  function retrySubmit() {
    void handleSubmit(submit, onInvalid)();
  }

  // Aplica la resolución a los campos y vuelve a la stage de fecha/horas
  // para que el organizador vea el valor actualizado antes de reintentar.
  function handleConflictResolution(resolution: ConflictResolution) {
    if (resolution.type === "move") {
      setValue("scheduled_date", resolution.date, { shouldDirty: true });
    } else {
      setValue("estimated_hours", String(resolution.hours), { shouldDirty: true });
    }
    setConflict(null);
    setStage(2); // stage "fecha" (índice 2: intro=0, básico=1, fecha=2, detalle=3)
  }

  const activeFieldStage = stage >= 1 && stage <= FIELD_STAGES.length ? FIELD_STAGES[stage - 1] : null;

  const stageHasError = (index: number): string | undefined => {
    if (index < 1 || index > FIELD_STAGES.length) return undefined;
    const fieldStage = FIELD_STAGES[index - 1];
    const firstErrorField = fieldStage.fields.find((field) => errors[field]);
    return firstErrorField ? errors[firstErrorField]?.message : undefined;
  };

  return (
    // Fragment, no solo <Modal>: OverloadConflictWizard tiene que vivir
    // FUERA de Modal (hermano, no hijo) para seguir montado con su propio
    // estado mientras Modal está oculto (open=false, más abajo) — si
    // quedara anidado adentro, ocultar Modal lo desmontaría a él también.
    <>
      <Modal
        // Oculto mientras OverloadConflictWizard está arriba (Sprint 3 / C3):
        // evita 2 fondos oscuros y 2 cajas apiladas a la vez.
        open={conflict === null}
        onClose={onClose}
        title="Nueva gestión"
        chips={[{ label: eventName }]}
        className="max-w-[560px]"
      >
      <div className="flex flex-col gap-6">
        <WizardStageIndicator
          total={TOTAL_STAGES}
          current={stage}
          furthest={furthest}
          disabled={false}
          errorFor={stageHasError}
          onNavigate={goToStage}
        />

        {stage === INTRO_STAGE && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <ClipboardList aria-hidden="true" size={48} className="text-[#8b1a1a]" />
            <p className="font-jost text-[22px] leading-[28px] text-[#101828]">
              ¡Vamos a crear una nueva gestión para «{eventName}»!
            </p>
            <p className="font-source text-[14px] text-[#4a5565]">
              Te vamos a hacer unas pocas preguntas, un paso a la vez.
            </p>
            <button
              type="button"
              onClick={() => {
                setStage(1);
                setFurthest((f) => Math.max(f, 1));
                ensureCategoriesLoaded();
              }}
              className="mt-2 rounded-lg bg-[#8b1a1a] px-6 py-[10px] font-jost text-[14px] text-white"
            >
              Comenzar
            </button>
          </div>
        )}

        {activeFieldStage && (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void handleNextFieldStage(stage);
            }}
            className="flex flex-col gap-4"
          >
            <h3 className="text-center font-jost text-[18px] text-[#101828]">{activeFieldStage.label}</h3>

            {apiError && (
              <div role="alert" className="flex flex-col gap-2 rounded-lg bg-[#fff0f0] p-3 text-[13px] text-[#8b1a1a]">
                <span>{apiError.message}</span>
                <button type="button" onClick={retrySubmit} className="w-fit font-jost text-[12px] underline">
                  Reintentar
                </button>
              </div>
            )}

            {activeFieldStage.key === "basico" && (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="wizard-subtask-title" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
                    Nombre
                  </label>
                  <input
                    id="wizard-subtask-title"
                    type="text"
                    aria-required="true"
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={errors.title ? "wizard-subtask-title-error" : undefined}
                    className={cn(
                      "h-9 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
                      errors.title && "border-red-600"
                    )}
                    {...register("title", {
                      required: "Escribe el nombre de la gestión.",
                      validate: (value) => value.trim().length > 0 || "Escribe el nombre de la gestión.",
                    })}
                  />
                  {errors.title && (
                    <p id="wizard-subtask-title-error" role="alert" className="text-[12px] text-red-600">
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
                      id="wizard-subtask-category"
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
              </>
            )}

            {activeFieldStage.key === "fecha" && (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="wizard-subtask-date" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
                    Fecha objetivo
                  </label>
                  <input
                    id="wizard-subtask-date"
                    type="date"
                    aria-required="true"
                    aria-invalid={Boolean(errors.scheduled_date)}
                    aria-describedby={
                      cn(
                        errors.scheduled_date && "wizard-subtask-date-error",
                        dateAfterEventDue && "wizard-subtask-date-warning"
                      ) || undefined
                    }
                    className={cn(
                      "h-9 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
                      errors.scheduled_date && "border-red-600"
                    )}
                    {...register("scheduled_date", { required: "Indica la fecha objetivo." })}
                  />
                  {errors.scheduled_date && (
                    <p id="wizard-subtask-date-error" role="alert" className="text-[12px] text-red-600">
                      {errors.scheduled_date.message}
                    </p>
                  )}
                  {!errors.scheduled_date && dateAfterEventDue && (
                    <p id="wizard-subtask-date-warning" role="status" className="text-[12px] text-[#bb4d00]">
                      La fecha objetivo es posterior a la fecha del evento.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span id="wizard-subtask-hours-label" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
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
                        id="wizard-subtask-hours"
                        value={field.value}
                        onChange={field.onChange}
                        invalid={Boolean(errors.estimated_hours)}
                        describedBy={errors.estimated_hours ? "wizard-subtask-hours-error" : undefined}
                      />
                    )}
                  />
                  {errors.estimated_hours && (
                    <p id="wizard-subtask-hours-error" role="alert" className="text-[12px] text-red-600">
                      {errors.estimated_hours.message}
                    </p>
                  )}
                </div>
              </>
            )}

            {activeFieldStage.key === "detalle" && (
              <div className="flex flex-col gap-1">
                <label htmlFor="wizard-subtask-description" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
                  Descripción
                </label>
                <textarea
                  id="wizard-subtask-description"
                  rows={3}
                  className="min-h-[54px] rounded-lg border border-[#d4d5d7] px-2 py-1 font-source text-[14px] leading-[22.75px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
                  {...register("description")}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-3 border-t border-[#f3f4f6] pt-4">
              <button
                type="button"
                onClick={() => setStage(stage - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-[0.635px] border-[#8b1a1a] px-4 py-[10px] font-jost text-[14px] text-[#8b1a1a]"
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Atrás
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="flex-1 rounded-lg bg-[#8b1a1a] py-[10px] font-jost text-[14px] text-white disabled:opacity-60"
              >
                {activeFieldStage.key === "detalle"
                  ? isSubmitting
                    ? "Creando…"
                    : "Crear gestión"
                  : "Siguiente"}
              </button>
            </div>
          </form>
        )}
      </div>

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
        onCancel={() => {
          setPendingPastDateValues(null);
          setStage(2); // vuelve a la stage de fecha/horas para que la cambie
        }}
      />
      </Modal>

      <OverloadConflictWizard
        key={wizardKey}
        open={conflict !== null}
        conflict={conflict}
        moveSuggestion={moveSuggestion}
        maxReduceHours={maxReduce}
        onBack={() => setConflict(null)}
        onConfirm={handleConflictResolution}
      />
    </>
  );
}
