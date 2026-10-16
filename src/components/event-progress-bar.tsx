// Barra segmentada de progreso del evento (completadas/pospuestas/pendientes),
// con selector Gestiones/Horas.

import { useId, useState } from "react";
import type { Subtask } from "../lib/types";
import { cn } from "../lib/utils";

type Metric = "gestiones" | "horas";

const COLORS = { done: "#10b981", postponed: "#a1a1aa", pending: "#fcd34d" };

export function EventProgressBar({ subtasks, label = "Progreso del evento" }: { subtasks: Subtask[]; label?: string }) {
  const [metric, setMetric] = useState<Metric>("gestiones");
  const labelId = useId();
  const isHoras = metric === "horas";

  const weight = (subtask: Subtask) => (isHoras ? Number(subtask.estimated_hours) || 0 : 1);
  const sum = (status?: Subtask["status"]) =>
    subtasks.filter((s) => !status || s.status === status).reduce((acc, s) => acc + weight(s), 0);

  const total = sum();
  const done = sum("done");
  const postponed = sum("postponed");
  const pending = total - done - postponed;
  const percentage = total > 0 ? Math.floor((done / total) * 100) : 0;
  const pct = (value: number) => (total > 0 ? `${(value / total) * 100}%` : "0%");
  const fmt = (value: number) => (isHoras ? `${Number(value.toFixed(2))} h` : String(value));

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <span className="font-jost text-3xl text-[#8b1a1a]">{percentage}%</span>
        <div className="flex flex-1 flex-col gap-1.5">
          <div
            role="progressbar"
            aria-label={label}
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={isHoras ? `${fmt(done)} de ${fmt(total)}` : `${done} de ${total} gestiones completadas`}
            className="flex h-[14px] w-full overflow-hidden rounded-full bg-[#f3f4f6]"
          >
            <div style={{ width: pct(done), backgroundColor: COLORS.done }} />
            <div style={{ width: pct(postponed), backgroundColor: COLORS.postponed }} />
            <div style={{ width: pct(pending), backgroundColor: COLORS.pending }} />
          </div>
          {total > 0 && done === total ? (
            <p className="font-source text-[13px] text-[#007a55]">¡Evento listo! <span aria-hidden="true">🎉</span></p>
          ) : (
            <p className="flex flex-wrap items-center gap-x-3 font-source text-[12px] text-[#4a5565]">
              {isHoras && <span>{`${fmt(done)} de ${fmt(total)}`}</span>}
              {(
                [
                  ["done", done, plural(done, "completada", "completadas")],
                  ["postponed", postponed, plural(postponed, "pospuesta", "pospuestas")],
                  ["pending", pending, plural(pending, "pendiente", "pendientes")],
                ] as const
              ).map(([key, value, label]) => (
                <span key={key} className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: COLORS[key] }} />
                  {`${fmt(value)} ${label}`}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
        <span id={labelId} className="filter-label">Mostrar progreso en:</span>
        <button
          type="button"
          onClick={() => setMetric("gestiones")}
          aria-pressed={!isHoras}
          className={cn("filter-button", !isHoras && "filter-button--active")}
        >
          Gestiones
        </button>
        <button
          type="button"
          onClick={() => setMetric("horas")}
          aria-pressed={isHoras}
          className={cn("filter-button", isHoras && "filter-button--active")}
        >
          Horas
        </button>
      </div>
    </div>
  );
}
