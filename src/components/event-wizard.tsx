// Wizard de creación de evento (PIM1-117, primera versión preliminar — ver
// "Correcciones de UI dadas por el profesor durante clínica de sprint 1",
// punto sobre reemplazar el Modal de creación por un paso a paso).
//
// Alcance de esta primera versión:
// - Solo CREAR (no reemplaza EventFormModal en modo edición: ese sigue
//   abriéndose igual desde "Editar evento").
// - Stage de intro + 3 stages de campos del evento (mismo agrupamiento que
//   tenía EventFormModal: qué evento / cuándo y dónde / para quién) + una
//   stage final de "plan inicial" para agregar las primeras gestiones del
//   evento recién creado, reutilizando GestionTable (misma tabla de la vista
//   expandida de un evento) y SubtaskFormModal (mismo formulario de "Nueva
//   gestión" que ya existe, anidado como modal sobre el wizard).
// - El evento se crea (POST) al confirmar la stage "¿Para quién?", no al
//   cerrar el wizard: así la stage de plan inicial ya tiene un eid real al
//   que asociar las gestiones. Por eso, una vez creado el evento, ya no se
//   puede volver a las stages anteriores (editarlo requiere el flujo normal
//   de "Editar evento" — no está en el alcance de esta primera versión).
// - Las gestiones de la stage final se crean una a una contra el backend
//   real (no hay un "guardar todo" al final): cada una ya queda persistida
//   en cuanto se agrega.

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Check, ChevronLeft, PartyPopper } from "lucide-react";
import { apiFetch, ApiError } from "../lib/api";
import { applyFieldErrors } from "../lib/form-errors";
import { GestionTable } from "./gestion-table";
import { Modal } from "./modal";
import { SubtaskFormModal } from "./subtask-form-modal";
import { CreatableSelect, type SelectOption } from "./creatable-select";
import { WizardStageIndicator } from "./wizard-stage-indicator";
import { sortSubtasksByDateThenHours } from "../lib/subtask-display";
import { cn } from "../lib/utils";
import type { CreateEventPayload, Event, EventType, Subtask } from "../lib/types";

interface EventWizardProps {
  onClose: () => void;
  onEventCreated: (event: Event) => void;
  onSubtaskCreated: (subtask: Subtask) => void;
}

interface EventWizardValues {
  name: string;
  eventTypeId: string;
  date: string;
  time: string;
  place: string;
  clientContact: string;
  description: string;
}

const EMPTY_VALUES: EventWizardValues = {
  name: "",
  eventTypeId: "",
  date: "",
  time: "",
  place: "",
  clientContact: "",
  description: "",
};

// Mismo respaldo que EventFormModal mientras GET /tipos-evento/ falle.
const EVENT_TYPE_FALLBACKS: EventType[] = [
  { id: "default-boda", name: "Boda" },
  { id: "default-social", name: "Social" },
  { id: "default-corporativo", name: "Corporativo" },
  { id: "default-cumpleanos", name: "Cumpleaños" },
  { id: "default-otro", name: "Otro" },
];

type FieldStageKey = "basico" | "fecha" | "contacto";

interface FieldStage {
  key: FieldStageKey;
  label: string;
  fields: (keyof EventWizardValues)[];
}

const FIELD_STAGES: FieldStage[] = [
  { key: "basico", label: "¿Qué evento es?", fields: ["name", "eventTypeId"] },
  { key: "fecha", label: "¿Cuándo y dónde?", fields: ["date", "time", "place"] },
  { key: "contacto", label: "¿Para quién?", fields: ["clientContact", "description"] },
];

// Stage 0 = intro, 1..3 = FIELD_STAGES, 4 = plan inicial.
const INTRO_STAGE = 0;
const PLAN_STAGE = FIELD_STAGES.length + 1;
const TOTAL_STAGES = PLAN_STAGE + 1;

function toIsoDueDate(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

function remapEventErrorFields(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const fields: Record<string, string> = {};
  for (const [key, message] of Object.entries(error.fields)) {
    if (key === "event_type") fields.eventTypeId = message;
    else if (key === "client_contact") fields.clientContact = message;
    else if (key === "due_date") fields.date = message;
    else fields[key] = message;
  }
  return new ApiError(error.message, error.status, error.code, fields);
}

const KNOWN_FIELDS = ["name", "description", "date", "eventTypeId", "place", "clientContact"] as const;

export function EventWizard({ onClose, onEventCreated, onSubtaskCreated }: EventWizardProps) {
  const [stage, setStage] = useState(INTRO_STAGE);
  // Furthest reached: permite volver a revisar una stage ya validada, pero no
  // saltar adelante sin pasar por "Siguiente" (ver corrección del profesor:
  // "el usuario puede devolverse o avanzar").
  const [furthest, setFurthest] = useState(INTRO_STAGE);
  const [createdEvent, setCreatedEvent] = useState<Event | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const [eventTypes, setEventTypes] = useState<SelectOption[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const typesLoadedRef = useRef(false);

  const [planSubtasks, setPlanSubtasks] = useState<Subtask[]>([]);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventWizardValues>({
    mode: "onBlur",
    shouldFocusError: true,
    defaultValues: EMPTY_VALUES,
  });

  // Carga perezosa (solo al llegar a la primera stage de campos, no en el
  // intro) — mismo patrón que EventFormModal, pero sin bloquear la stage de
  // bienvenida con un fetch que todavía no hace falta.
  function ensureEventTypesLoaded() {
    if (typesLoadedRef.current) return;
    typesLoadedRef.current = true;
    apiFetch<EventType[]>("/tipos-evento/")
      .then((data) => setEventTypes(data))
      .catch(() => setEventTypes(EVENT_TYPE_FALLBACKS))
      .finally(() => setTypesLoading(false));
  }

  async function createEventType(name: string): Promise<SelectOption> {
    const created = await apiFetch<EventType>("/tipos-evento/", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return created;
  }

  function goToStage(index: number) {
    if (index > furthest) return; // no saltar adelante por los círculos
    if (createdEvent && index <= FIELD_STAGES.length) return; // evento ya creado: ya no se editan sus campos acá
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
      if (FIELD_STAGES[next - 1].key === "fecha" || FIELD_STAGES[next - 1].key === "basico") {
        ensureEventTypesLoaded();
      }
      return;
    }

    // Última stage de campos ("¿Para quién?"): acá se crea el evento de verdad.
    await handleSubmit(submitEvent, onInvalidEvent)();
  }

  // Si handleSubmit encuentra errores en stages anteriores (ej. el usuario
  // volvió y borró el nombre), navega a la primera stage con error en vez de
  // dejar el formulario "colgado" en la última stage sin pista visual de
  // dónde está el problema.
  function onInvalidEvent(formErrors: typeof errors) {
    const erroredStageIndex = FIELD_STAGES.findIndex((fieldStage) =>
      fieldStage.fields.some((field) => field in formErrors)
    );
    if (erroredStageIndex >= 0) setStage(erroredStageIndex + 1);
  }

  async function submitEvent(values: EventWizardValues) {
    setApiError(null);
    const payload: CreateEventPayload = {
      name: values.name.trim(),
      description: values.description.trim(),
      due_date: toIsoDueDate(values.date, values.time),
    };
    if (values.place.trim()) payload.place = values.place.trim();
    if (values.clientContact.trim()) payload.client_contact = values.clientContact.trim();
    if (values.eventTypeId && !values.eventTypeId.startsWith("default-")) {
      payload.event_type = Number(values.eventTypeId);
    }

    try {
      const created = await apiFetch<Event>("/eventos/", { method: "POST", body: JSON.stringify(payload) });
      setCreatedEvent(created);
      onEventCreated(created);
      setStage(PLAN_STAGE);
      setFurthest(PLAN_STAGE);
    } catch (err) {
      const remapped = remapEventErrorFields(err);
      const painted = applyFieldErrors(remapped, setError, KNOWN_FIELDS);
      if (!painted) {
        setApiError(
          err instanceof ApiError ? err : new ApiError("Ocurrió un error inesperado. Intenta de nuevo.", 0, "UNKNOWN")
        );
      }
    }
  }

  function retrySubmit() {
    void handleSubmit(submitEvent, onInvalidEvent)();
  }

  function handleSubtaskCreated(subtask: Subtask) {
    setIsAddingSubtask(false);
    setPlanSubtasks((prev) => [...prev, subtask]);
    onSubtaskCreated(subtask);
  }

  const activeFieldStage = stage >= 1 && stage <= FIELD_STAGES.length ? FIELD_STAGES[stage - 1] : null;

  // Para el indicador de círculos: qué stages de campo tienen error ahora
  // mismo (para la X roja + tooltip, ver corrección del profesor).
  const stageHasError = (index: number): string | undefined => {
    if (index < 1 || index > FIELD_STAGES.length) return undefined;
    const fieldStage = FIELD_STAGES[index - 1];
    const firstErrorField = fieldStage.fields.find((field) => errors[field]);
    return firstErrorField ? errors[firstErrorField]?.message : undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={createdEvent ? createdEvent.name : "Nuevo evento"}
      className="max-w-[560px]"
    >
      <div className="flex flex-col gap-6">
        <WizardStageIndicator
          total={TOTAL_STAGES}
          current={stage}
          furthest={furthest}
          disabled={Boolean(createdEvent)}
          errorFor={stageHasError}
          onNavigate={goToStage}
        />

        {stage === INTRO_STAGE && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <PartyPopper aria-hidden="true" size={48} className="text-[#8b1a1a]" />
            <p className="font-jost text-[22px] leading-[28px] text-[#101828]">¡Vamos a crear un nuevo evento!</p>
            <p className="font-source text-[14px] text-[#4a5565]">
              Te vamos a hacer unas pocas preguntas, un paso a la vez.
            </p>
            <button
              type="button"
              onClick={() => {
                setStage(1);
                setFurthest((f) => Math.max(f, 1));
                ensureEventTypesLoaded();
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
                  <label htmlFor="wizard-event-name" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
                    Nombre
                  </label>
                  <input
                    id="wizard-event-name"
                    type="text"
                    maxLength={150}
                    aria-required="true"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "wizard-event-name-error" : undefined}
                    className={cn(
                      "h-9 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
                      errors.name && "border-red-600"
                    )}
                    {...register("name", {
                      required: "Escribe el nombre del evento.",
                      maxLength: { value: 150, message: "El nombre no puede superar 150 caracteres." },
                      validate: (value) => value.trim().length > 0 || "Escribe el nombre del evento.",
                    })}
                  />
                  {errors.name && (
                    <p id="wizard-event-name-error" role="alert" className="text-[12px] text-red-600">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <Controller
                  name="eventTypeId"
                  control={control}
                  rules={{ required: "Elige un tipo de evento." }}
                  render={({ field }) => (
                    <CreatableSelect
                      id="wizard-event-type"
                      label="Tipo"
                      required
                      options={eventTypes}
                      loading={typesLoading}
                      value={field.value || null}
                      onChange={(value) => field.onChange(String(value))}
                      onBlur={field.onBlur}
                      error={errors.eventTypeId?.message}
                      helperText="Elige el tipo o crea uno personalizado."
                      createLabel="Crear tipo personalizado"
                      onCreate={createEventType}
                    />
                  )}
                />
              </>
            )}

            {activeFieldStage.key === "fecha" && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="wizard-event-date" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
                      Fecha
                    </label>
                    <input
                      id="wizard-event-date"
                      type="date"
                      aria-required="true"
                      aria-invalid={Boolean(errors.date)}
                      aria-describedby={errors.date ? "wizard-event-date-error" : undefined}
                      className={cn(
                        "h-9 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
                        errors.date && "border-red-600"
                      )}
                      {...register("date", { required: "Indica la fecha del evento." })}
                    />
                    {errors.date && (
                      <p id="wizard-event-date-error" role="alert" className="text-[12px] text-red-600">
                        {errors.date.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="wizard-event-time" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
                      Hora
                    </label>
                    <input
                      id="wizard-event-time"
                      type="time"
                      inputMode="numeric"
                      aria-required="true"
                      aria-invalid={Boolean(errors.time)}
                      aria-describedby={errors.time ? "wizard-event-time-error" : undefined}
                      className={cn(
                        "h-9 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
                        errors.time && "border-red-600"
                      )}
                      {...register("time", { required: "Indica la hora del evento." })}
                    />
                    {errors.time && (
                      <p id="wizard-event-time-error" role="alert" className="text-[12px] text-red-600">
                        {errors.time.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="wizard-event-place" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
                    Lugar
                  </label>
                  <input
                    id="wizard-event-place"
                    type="text"
                    className="h-9 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
                    {...register("place")}
                  />
                </div>
              </>
            )}

            {activeFieldStage.key === "contacto" && (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="wizard-event-client" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
                    Cliente / Contacto
                  </label>
                  <input
                    id="wizard-event-client"
                    type="text"
                    className="h-9 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
                    {...register("clientContact")}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="wizard-event-description" className="font-jost text-[12px] tracking-[1px] text-[#4a5565] uppercase">
                    Descripción
                  </label>
                  <textarea
                    id="wizard-event-description"
                    rows={3}
                    className="min-h-[54px] rounded-lg border border-[#d4d5d7] px-2 py-1 font-source text-[14px] leading-[22.75px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
                    {...register("description")}
                  />
                </div>
              </>
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
                {activeFieldStage.key === "contacto"
                  ? isSubmitting
                    ? "Creando…"
                    : "Crear evento"
                  : "Siguiente"}
              </button>
            </div>
          </form>
        )}

        {stage === PLAN_STAGE && createdEvent && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <Check aria-hidden="true" size={28} className="text-[#00a63e]" />
              <h3 className="font-jost text-[18px] text-[#101828]">Plan inicial de gestiones</h3>
              <p className="font-source text-[13px] text-[#4a5565]">
                Agrega las primeras gestiones para «{createdEvent.name}», o termina y agrégalas después.
              </p>
            </div>

            <GestionTable
              items={sortSubtasksByDateThenHours(planSubtasks)}
              onAddNew={() => setIsAddingSubtask(true)}
              addNewLabel="Agregar gestión"
            />

            <div className="flex border-t border-[#f3f4f6] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg bg-[#8b1a1a] py-[10px] font-jost text-[14px] text-white"
              >
                Finalizar
              </button>
            </div>
          </div>
        )}
      </div>

      {isAddingSubtask && createdEvent && (
        <SubtaskFormModal
          eventId={createdEvent.eid}
          eventName={createdEvent.name}
          eventDueDate={createdEvent.due_date}
          onClose={() => setIsAddingSubtask(false)}
          onCreated={(subtask) => handleSubtaskCreated(subtask)}
        />
      )}
    </Modal>
  );
}
