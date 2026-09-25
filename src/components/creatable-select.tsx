// Select reutilizable con opción de crear un valor personalizado (PIM1-89,
// y luego categorías en PIM1-27). Se usa como componente controlado: se
// integra con react-hook-form mediante <Controller value/onChange>.

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ApiError } from "../lib/api";
import { cn } from "../lib/utils";

export interface SelectOption {
  id: string | number;
  name: string;
}

const CREATE_VALUE = "__create__";

interface CreatableSelectProps {
  id?: string;
  label: string;
  options: SelectOption[];
  value: string | number | null;
  onChange: (value: string | number) => void;
  onBlur?: () => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  helperText?: string;
  createLabel?: string;
  onCreate: (name: string) => Promise<SelectOption>;
}

export function CreatableSelect({
  id,
  label,
  options,
  value,
  onChange,
  onBlur,
  loading = false,
  disabled = false,
  error,
  required = false,
  helperText,
  createLabel = "Crear personalizado",
  onCreate,
}: CreatableSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const createErrorId = `${selectId}-create-error`;

  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Opciones creadas en esta sesión: se conservan aunque el listado del
  // padre todavía no las incluya (por ejemplo si no vuelve a pedir GET).
  const [extraOptions, setExtraOptions] = useState<SelectOption[]>([]);

  const allOptions = [
    ...options,
    ...extraOptions.filter((extra) => !options.some((option) => String(option.id) === String(extra.id))),
  ];

  function handleSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const raw = event.target.value;
    if (raw === CREATE_VALUE) {
      setCreating(true);
      setCreateError(null);
      setDraftName("");
      return;
    }
    const match = allOptions.find((option) => String(option.id) === raw);
    onChange(match ? match.id : raw);
  }

  function cancelCreate() {
    setCreating(false);
    setDraftName("");
    setCreateError(null);
  }

  async function confirmCreate() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setCreateError("Escribe un nombre antes de agregar.");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      const created = await onCreate(trimmed);
      setExtraOptions((prev) => [...prev, created]);
      onChange(created.id);
      setCreating(false);
      setDraftName("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo crear la opción. Intenta de nuevo.";
      setCreateError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="font-jost text-[10px] tracking-[1px] text-[#99a1af] uppercase">
        {label}
      </label>

      {!creating ? (
        <div className="relative">
          <select
            id={selectId}
            value={value ?? ""}
            onChange={handleSelectChange}
            onBlur={onBlur}
            disabled={disabled || loading}
            aria-required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-8 w-full appearance-none rounded-lg border border-[#d4d5d7] bg-white pr-8 pl-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a] disabled:opacity-60",
              error && "border-red-600"
            )}
          >
            <option value="" disabled>
              {loading ? "Cargando opciones…" : "Selecciona una opción"}
            </option>
            {allOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
            <option value={CREATE_VALUE}>{createLabel}</option>
          </select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#99a1af]"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-[#d4d5d7] p-2">
          <input
            autoFocus
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              // Enter/Escape acá son para el mini-formulario de creación, no
              // para el formulario padre (que si no, enviaría o el modal se
              // cerraría entero perdiendo lo escrito).
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                confirmCreate();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelCreate();
              }
            }}
            placeholder="Nombre del tipo"
            aria-label={createLabel}
            aria-invalid={Boolean(createError)}
            aria-describedby={createError ? createErrorId : undefined}
            className="h-8 rounded-md border border-[#d4d5d7] px-2 font-source text-[14px] text-[#1e2939] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
          />
          {createError && (
            <p id={createErrorId} role="alert" className="text-[12px] text-red-600">
              {createError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmCreate}
              disabled={submitting}
              className="h-7 flex-1 rounded-md bg-[#8b1a1a] font-jost text-[12px] text-white disabled:opacity-50"
            >
              {submitting ? "Agregando…" : "Agregar"}
            </button>
            <button
              type="button"
              onClick={cancelCreate}
              disabled={submitting}
              className="h-7 flex-1 rounded-md border border-[#8b1a1a] font-jost text-[12px] text-[#8b1a1a] disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p id={errorId} role="alert" className="text-[12px] text-red-600">
          {error}
        </p>
      ) : (
        helperText && <p className="text-[12px] text-[#99a1af]">{helperText}</p>
      )}
    </div>
  );
}
