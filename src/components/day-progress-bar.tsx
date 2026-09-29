// PIM1-55: barra de progreso del día (Vista Hoy), con toggle Gestiones/Horas.
// progreso_dia ya trae ambas métricas siempre (ver TodaySummary): el toggle
// es puro estado local, no dispara ningún refetch.

import { formatDuration } from "../lib/subtask-display";
import type { DayProgress } from "../lib/types";
import { cn } from "../lib/utils";

type Metric = "gestiones" | "horas";

interface DayProgressBarProps {
  progress: DayProgress;
  metric: Metric;
  onMetricChange: (metric: Metric) => void;
}

export function DayProgressBar({ progress, metric, onMetricChange }: DayProgressBarProps) {
  // Nunca dividir por cero: sin gestiones agendadas hoy no hay nada que medir.
  if (progress.total === 0) {
    return <p className="font-source text-[13px] text-[#99a1af]">No hay tareas asignadas para hoy.</p>;
  }

  const isHoras = metric === "horas";
  const horasCompletadas = Number(progress.horas_completadas);
  const horasTotales = Number(progress.horas_totales);
  const completedValue = isHoras ? horasCompletadas : progress.completadas;
  const totalValue = isHoras ? horasTotales : progress.total;
  const percentage = totalValue > 0 ? Math.round((completedValue / totalValue) * 100) : 0;
  // "para hoy completadas" (no "completadas hoy"): aclara que son las
  // agendadas PARA hoy las que se cuentan acá — una vencida o próxima que se
  // completó hoy aparece en el panel de Completadas, pero no suma en esta
  // barra (ver el comentario en homepage.tsx sobre progreso_dia).
  const label = isHoras
    ? `${formatDuration(progress.horas_completadas)}/${formatDuration(progress.horas_totales)} horas para hoy completadas`
    : `${progress.completadas}/${progress.total} gestiones para hoy completadas`;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-center font-source text-[13px] text-[#4a5565]">{label}</p>
      <div
        role="progressbar"
        aria-label="Progreso del día"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        // border: el track (#f3f4f6) se perdía contra el fondo de la página
        // (--surface, #f7f5f2 en homepage.css) — casi el mismo gris.
        className="h-2 w-full overflow-hidden rounded-full border border-[#e5e7eb] bg-[#f3f4f6]"
      >
        <div className="h-full rounded-full bg-[#8b1a1a]" style={{ width: `${percentage}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="filter-label">Mostrar progreso en:</span>
        <button
          type="button"
          onClick={() => onMetricChange("gestiones")}
          aria-pressed={!isHoras}
          className={cn("filter-button", !isHoras && "filter-button--active")}
        >
          Gestiones
        </button>
        <button
          type="button"
          onClick={() => onMetricChange("horas")}
          aria-pressed={isHoras}
          className={cn("filter-button", isHoras && "filter-button--active")}
        >
          Horas
        </button>
      </div>
    </div>
  );
}
