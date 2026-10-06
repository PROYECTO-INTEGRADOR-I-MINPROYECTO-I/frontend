import { parseLocalDate, toLocalDateString, todayLocalDateString } from "./dates";
import type { Subtask } from "./types";

export interface PlanningConflict {
  plannedHours: number;
  limit: number;
  suggestedDate: string | null;
  reducibleHours: number | null;
}

function hoursForDate(subtasks: Subtask[], date: string, excludeSubtaskId?: number): number {
  return subtasks.reduce((total, subtask) => {
    if (
      subtask.subtask_id === excludeSubtaskId ||
      subtask.status === "done" ||
      subtask.scheduled_date !== date
    ) {
      return total;
    }
    return total + Number(subtask.estimated_hours);
  }, 0);
}

export function findPlanningConflict(
  subtasks: Subtask[],
  date: string,
  estimatedHours: string,
  limit: number,
  excludeSubtaskId?: number
): PlanningConflict | null {
  const hours = Number(estimatedHours);
  if (!date || !Number.isFinite(hours) || hours <= 0 || !Number.isFinite(limit) || limit <= 0) return null;

  const plannedHours = hoursForDate(subtasks, date, excludeSubtaskId) + hours;
  if (plannedHours <= limit) return null;

  let suggestedDate: string | null = null;
  const candidate = parseLocalDate(date < todayLocalDateString() ? todayLocalDateString() : date);
  for (let offset = 1; offset <= 365; offset += 1) {
    candidate.setDate(candidate.getDate() + 1);
    const candidateDate = toLocalDateString(candidate);
    if (hoursForDate(subtasks, candidateDate, excludeSubtaskId) + hours <= limit) {
      suggestedDate = candidateDate;
      break;
    }
  }

  const reducibleHours = hoursForDate(subtasks, date, excludeSubtaskId);
  return {
    plannedHours,
    limit,
    suggestedDate,
    reducibleHours: reducibleHours < hours ? Math.max(0, limit - reducibleHours) : null,
  };
}

export function formatPlanningHours(hours: number): string {
  return `${Number(hours.toFixed(2))}h`;
}
