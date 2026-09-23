// Formulario de creación de evento (PIM1-23) dentro del Modal reutilizable.
// Campos agrupados por intención: qué evento / cuándo y dónde / para quién.

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { apiFetch, ApiError } from "../lib/api";
import { applyFieldErrors } from "../lib/form-errors";
import type { CreateEventPayload, Event, EventType } from "../lib/types";
import { Modal } from "./modal";
import { CreatableSelect, type SelectOption } from "./creatable-select";
import { cn } from "../lib/utils";

interface EventFormModalProps {
  onClose: () => void;
  onCreated: (event: Event) => void;
}

interface EventFormValues {
  name: string;
  eventTypeId: string;
  date: string;
  time: string;
  place: string;
  clientContact: string;
  description: string;
}

const EMPTY_VALUES: EventFormValues = {
  name: "",
  eventTypeId: "",
  date: "",
  time: "",
  place: "",
  clientContact: "",
  description: "",
};

// Respaldo mientras GET /tipos-evento/ no existe en el backend (PIM1-89).
// Los ids "default-*" nunca se envían como event_type: al crear con uno de
// estos, el evento queda sin tipo hasta que backend agregue el endpoint real.
const EVENT_TYPE_FALLBACKS: EventType[] = [
  { id: "default-boda", name: "Boda" },
  { id: "default-social", name: "Social" },
  { id: "default-corporativo", name: "Corporativo" },
  { id: "default-cumpleanos", name: "Cumpleaños" },
  { id: "default-otro", name: "Otro" },
];

// Nombres de campo del formulario que sí tienen contraparte en el error del
// backend (después de remapEventErrorFields).
const KNOWN_FIELDS = ["name", "description", "date", "eventTypeId", "place", "clientContact"] as const;

function toIsoDueDate(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

// El backend nombra los campos distinto al formulario (due_date/event_type/
// client_contact vs date+time/eventTypeId/clientContact): se traducen antes
// de pintar los errores para que applyFieldErrors encuentre el campo real.
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

export function EventFormModal({ onClose, onCreated }: EventFormModalProps) {
  const [eventTypes, setEventTypes] = useState<SelectOption[]>([]);
  // Empieza en true: el fetch arranca apenas se monta el componente (el
  // padre solo lo monta cuando el modal debe abrirse, con una key nueva
  // en cada apertura para forzar un montaje limpio).
  const [typesLoading, setTypesLoading] = useState(true);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EventFormValues>({ mode: "onBlur", shouldFocusError: true, defaultValues: EMPTY_VALUES });

  useEffect(() => {
    let cancelled = false;
    apiFetch<EventType[]>("/tipos-evento/")
      .then((data) => {
        if (!cancelled) setEventTypes(data);
      })
      .catch(() => {
        if (!cancelled) setEventTypes(EVENT_TYPE_FALLBACKS);
      })
      .finally(() => {
        if (!cancelled) setTypesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function createEventType(name: string): Promise<SelectOption> {
    const created = await apiFetch<EventType>("/tipos-evento/", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return created;
  }

  async function submit(values: EventFormValues) {
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
      const created = await apiFetch<Event>("/eventos/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreated(created);
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
    <Modal open onClose={handleClose} title="Nuevo evento">
      <form
        noValidate
        onSubmit={handleSubmit(submit)}
        className="flex flex-col gap-4"
      >
        {apiError && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg bg-[#fff0f0] p-3 text-[13px] text-[#8b1a1a]">
            <span>{apiError.message}</span>
            <button type="button" onClick={retry} className="w-fit font-jost text-[12px] underline">
              Reintentar
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="event-name" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
            Nombre
          </label>
          <input
            id="event-name"
            type="text"
            maxLength={150}
            aria-required="true"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "event-name-error" : undefined}
            className={cn(
              "h-8 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
              errors.name && "border-red-600"
            )}
            {...register("name", {
              required: "Escribe el nombre del evento.",
              maxLength: { value: 150, message: "El nombre no puede superar 150 caracteres." },
              validate: (value) => value.trim().length > 0 || "Escribe el nombre del evento.",
            })}
          />
          {errors.name ? (
            <p id="event-name-error" role="alert" className="text-[12px] text-red-600">
              {errors.name.message}
            </p>
          ) : (
            <p className="text-[12px] text-[#99a1af]">Ej. Boda Luisa &amp; Carlos</p>
          )}
        </div>

        <Controller
          name="eventTypeId"
          control={control}
          rules={{ required: "Elige un tipo de evento." }}
          render={({ field }) => (
            <CreatableSelect
              id="event-type"
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

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="event-date" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
              Fecha
            </label>
            <input
              id="event-date"
              type="date"
              aria-required="true"
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? "event-date-error" : undefined}
              className={cn(
                "h-8 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
                errors.date && "border-red-600"
              )}
              {...register("date", { required: "Indica la fecha del evento." })}
            />
            {errors.date ? (
              <p id="event-date-error" role="alert" className="text-[12px] text-red-600">
                {errors.date.message}
              </p>
            ) : (
              <p className="text-[12px] text-[#99a1af]">Obligatoria</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="event-time" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
              Hora
            </label>
            <input
              id="event-time"
              type="time"
              inputMode="numeric"
              aria-required="true"
              aria-invalid={Boolean(errors.time)}
              aria-describedby={errors.time ? "event-time-error" : undefined}
              className={cn(
                "h-8 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]",
                errors.time && "border-red-600"
              )}
              {...register("time", { required: "Indica la hora del evento." })}
            />
            {errors.time ? (
              <p id="event-time-error" role="alert" className="text-[12px] text-red-600">
                {errors.time.message}
              </p>
            ) : (
              <p className="text-[12px] text-[#99a1af]">Obligatoria</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-[#f3f4f6] pt-4">
          <label htmlFor="event-place" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
            Lugar
          </label>
          <input
            id="event-place"
            type="text"
            className="h-8 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
            {...register("place")}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="event-client" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
            Cliente / Contacto
          </label>
          <input
            id="event-client"
            type="text"
            className="h-8 rounded-lg border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
            {...register("clientContact")}
          />
        </div>

        <div className="flex flex-col gap-1 border-t border-[#f3f4f6] pt-4">
          <label htmlFor="event-description" className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
            Descripción
          </label>
          <textarea
            id="event-description"
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
