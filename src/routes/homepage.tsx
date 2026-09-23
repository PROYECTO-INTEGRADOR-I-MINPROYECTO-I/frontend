import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Sun } from "lucide-react";
import calendarIcon from "../assets/calendar-icon.svg";
import helpRing from "../assets/help-ring.svg";
import { EventMenu } from "../components/event-menu";
import { EventFormModal } from "../components/event-form-modal";
import { SubtaskFormModal } from "../components/subtask-form-modal";
import { SubtaskDetailModal } from "../components/subtask-detail-modal";
import { SubtaskCard } from "../components/subtask-card";
import { apiFetch, ApiError } from "../lib/api";
import { todayLocalDateString } from "../lib/dates";
import { sortSubtasksByDateThenPriority } from "../lib/subtask-display";
import type { Event, Subtask, SubtaskStatus } from "../lib/types";
import "./homepage.css";

const filters = ["Todos", "Reuniones", "Entregas", "Llamadas", "Personal"];

// Solo un entero positivo es un eid válido; cualquier otro valor de
// ?evento= (vacío, texto, decimales) se trata como "sin selección".
const EVENT_ID_PATTERN = /^\d+$/;
const SCHEDULED_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN_SUBTASK_STATUSES: SubtaskStatus[] = ["pending", "done", "postponed"];

function ClockIcon({ muted = false }: { muted?: boolean }) {
  return <span aria-hidden="true" className={`clock-icon${muted ? " clock-icon--muted" : ""}`} />;
}

function SunIcon() {
  // El glifo ☼ no existe en Source Sans 3 (fuente cargada tras PIM1-89):
  // se reemplaza por el icono equivalente de lucide-react.
  return (
    <span aria-hidden="true" className="sun-icon">
      <Sun size={28} />
    </span>
  );
}

export function HomePage() {
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState<Event[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  // Sube en cada apertura para forzar un montaje limpio de EventFormModal /
  // SubtaskFormModal (defaultValues frescos y fetch de tipos/categorías sin
  // depender de un reset() en efecto).
  const [formKey, setFormKey] = useState(0);
  const [newEvent, setNewEvent] = useState<Event | null>(null);

  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = useState(false);
  const [subtaskFormKey, setSubtaskFormKey] = useState(0);
  const [detailSubtask, setDetailSubtask] = useState<Subtask | null>(null);

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtasksStatus, setSubtasksStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [subtasksError, setSubtasksError] = useState("");

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  // Se incrementa en cada carga (cambio de evento o "Reintentar"). Si la
  // respuesta llega y ya no coincide con el contador actual, es una carga
  // vieja (por ejemplo A->B con la respuesta de A llegando tarde) y se
  // descarta en vez de pisar los datos del evento que sigue seleccionado.
  const subtasksRequestIdRef = useRef(0);

  const eventoParam = searchParams.get("evento");
  const selectedEventId = eventoParam && EVENT_ID_PATTERN.test(eventoParam) ? Number(eventoParam) : null;
  const selectedEvent = events.find((event) => event.eid === selectedEventId) ?? null;

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    };
  }, []);

  async function loadSubtasks(eid: number) {
    const requestId = (subtasksRequestIdRef.current += 1);
    setSubtasksStatus("loading");
    setSubtasksError("");
    try {
      const data = await apiFetch<Subtask[]>(`/eventos/${eid}/subtareas/`);
      if (subtasksRequestIdRef.current !== requestId) return; // respuesta de una carga anterior: se descarta
      setSubtasks(data);
      setSubtasksStatus("ready");
    } catch (err) {
      if (subtasksRequestIdRef.current !== requestId) return;
      setSubtasksError(err instanceof ApiError ? err.message : "No pudimos cargar las gestiones.");
      setSubtasksStatus("error");
    }
  }

  useEffect(() => {
    if (selectedEventId == null) {
      subtasksRequestIdRef.current += 1; // invalida cualquier carga en curso de un evento anterior
      setSubtasks([]);
      setSubtasksStatus("idle");
      return;
    }
    loadSubtasks(selectedEventId);
    // Solo cuando cambia el evento seleccionado: la recarga manual usa "Reintentar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  function showSuccess(message: string) {
    setSuccessMessage(message);
    if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = window.setTimeout(() => setSuccessMessage(null), 4000);
  }

  function handleSelectEvent(event: Event | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (event) next.set("evento", String(event.eid));
        else next.delete("evento");
        return next;
      },
      { replace: true }
    );
  }

  function openCreateForm() {
    setFormKey((key) => key + 1);
    setIsFormOpen(true);
  }

  function openSubtaskForm() {
    setSubtaskFormKey((key) => key + 1);
    setIsSubtaskFormOpen(true);
  }

  function handleEventCreated(event: Event) {
    setIsFormOpen(false);
    setNewEvent(event);
    handleSelectEvent(event);
    showSuccess("Evento creado exitosamente");
  }

  function handleSubtaskCreated(subtask: Subtask, warnings?: string[]) {
    setIsSubtaskFormOpen(false);
    const extra = warnings && warnings.length > 0 ? ` ${warnings.join(" ")}` : "";
    showSuccess(`Gestión agregada.${extra}`);

    // Se asume que el 201 de POST /eventos/<eid>/subtareas/ siempre trae
    // scheduled_date ("YYYY-MM-DD") y status válidos, que es lo que usa el
    // reparto en columnas. Si el backend responde algo que no calza con esa
    // suposición, no insertamos a ciegas (quedaría una tarjeta huérfana en
    // ninguna columna): se recarga la lista completa del evento.
    const hasExpectedShape =
      typeof subtask.scheduled_date === "string" &&
      SCHEDULED_DATE_PATTERN.test(subtask.scheduled_date) &&
      KNOWN_SUBTASK_STATUSES.includes(subtask.status);

    if (hasExpectedShape) {
      setSubtasks((prev) => [...prev, subtask]);
    } else if (selectedEventId != null) {
      loadSubtasks(selectedEventId);
    }
  }

  const todayDate = todayLocalDateString();
  const upcoming: Subtask[] = [];
  const todayPending: Subtask[] = [];
  const todayDone: Subtask[] = [];
  const overdue: Subtask[] = [];

  for (const subtask of subtasks) {
    if (subtask.scheduled_date > todayDate) {
      upcoming.push(subtask);
    } else if (subtask.scheduled_date === todayDate) {
      (subtask.status === "done" ? todayDone : todayPending).push(subtask);
    } else if (subtask.status !== "done") {
      overdue.push(subtask);
    }
    // Completada con fecha anterior a hoy: no cae en ninguna columna según el
    // ticket (Vencidas excluye "done", Para hoy exige fecha == hoy). Si en el
    // futuro se necesita ver ese historial, hay que decidir dónde mostrarlo.
  }

  const sortedUpcoming = sortSubtasksByDateThenPriority(upcoming);
  const sortedTodayPending = sortSubtasksByDateThenPriority(todayPending);
  const sortedTodayDone = sortSubtasksByDateThenPriority(todayDone);
  const sortedOverdue = sortSubtasksByDateThenPriority(overdue);

  return (
    <main className="planner-shell">
      <header className="planner-header">
        <div className="brand-lockup">
          <div className="brand-mark">
            <img src={calendarIcon} alt="" />
          </div>
          <span className="brand-name">PlanificApp</span>
        </div>

        <div className="date-label" aria-label="Hoy, 17 de septiembre de 2026">
          <span>Hoy</span>
          <span className="date-divider">—</span>
          <time dateTime="2026-09-17">17 sep. 2026</time>
        </div>

        <div className="avatar" aria-label="Perfil de AL">AL</div>
      </header>

      <div aria-live="polite" role="status" className="success-toast" data-visible={Boolean(successMessage)}>
        {successMessage}
      </div>

      <section className="planner-intro" aria-labelledby="today-heading">
        <div className="intro-row">
          <h1 id="today-heading">Hoy <SunIcon /></h1>
          <div className="intro-actions">
            {selectedEventId != null && subtasksStatus === "ready" && subtasks.length > 0 && (
              <button
                type="button"
                className="create-task-button create-task-button--compact"
                onClick={openSubtaskForm}
              >
                Crear Tarea <Plus aria-hidden="true" size={16} />
              </button>
            )}
            <EventMenu
              selectedEventId={selectedEventId}
              onSelect={handleSelectEvent}
              onCreateNew={openCreateForm}
              newEvent={newEvent}
              onNewEventConsumed={() => setNewEvent(null)}
              onEventsLoaded={setEvents}
            />
          </div>
        </div>

        <div className="filter-row" aria-label="Filtros de tareas">
          <span className="filter-label">Filtros</span>
          {filters.map((filter) => (
            <button
              className={`filter-button${activeFilter === filter ? " filter-button--active" : ""}`}
              key={filter}
              onClick={() => setActiveFilter(filter)}
              type="button"
              aria-pressed={activeFilter === filter}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      {selectedEventId != null && subtasksStatus === "loading" && (
        <p role="status" className="subtasks-status">
          Cargando gestiones…
        </p>
      )}

      {selectedEventId != null && subtasksStatus === "error" && (
        <div role="alert" className="subtasks-status subtasks-status--error">
          <p>{subtasksError}</p>
          <button type="button" onClick={() => loadSubtasks(selectedEventId)}>
            Reintentar
          </button>
        </div>
      )}

      {(selectedEventId == null || subtasksStatus === "ready") && (
        <section className="task-columns" aria-label="Tareas del día">
          <TaskColumn title="Próximas" countClass="count--blue" count={String(sortedUpcoming.length)} showClock>
            {selectedEventId != null && sortedUpcoming.length > 0 && (
              <div className="column-list">
                {sortedUpcoming.map((subtask) => (
                  <SubtaskCard key={subtask.subtask_id} subtask={subtask} onOpen={setDetailSubtask} />
                ))}
              </div>
            )}
            {selectedEventId != null && subtasks.length > 0 && sortedUpcoming.length === 0 && (
              <p className="column-empty-hint">Sin gestiones próximas.</p>
            )}
          </TaskColumn>

          <TaskColumn
            title="Para Hoy"
            countClass="count--red"
            count={String(sortedTodayPending.length + sortedTodayDone.length)}
          >
            {selectedEventId == null ? (
              <div className="column-empty-wrap">
                <div className="empty-state">
                  <p>
                    Aún no tienes tareas
                    <br />
                    ¡Crea una nueva!
                  </p>
                  <button className="create-task-button" type="button" onClick={openCreateForm}>
                    Crear Tarea <Plus aria-hidden="true" size={22} />
                  </button>
                </div>
              </div>
            ) : subtasks.length === 0 ? (
              <div className="column-empty-wrap">
                <div className="empty-state">
                  <p>
                    Aún no has agregado
                    <br />
                    gestiones a este evento
                  </p>
                  <button className="create-task-button" type="button" onClick={openSubtaskForm}>
                    Crear Tarea <Plus aria-hidden="true" size={22} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="today-panels">
                <TodayPanel
                  label="Pendientes"
                  dotColor="#ffb900"
                  countBg="#fffbeb"
                  countText="#bb4d00"
                  items={sortedTodayPending}
                  emptyHint="Sin pendientes para hoy."
                  onOpen={setDetailSubtask}
                />
                <TodayPanel
                  label="Completadas"
                  dotColor="#00d492"
                  countBg="#ecfdf5"
                  countText="#007a55"
                  items={sortedTodayDone}
                  emptyHint="Sin gestiones completadas."
                  onOpen={setDetailSubtask}
                  completed
                />
              </div>
            )}
          </TaskColumn>

          <TaskColumn title="Vencidas" countClass="count--red" count={String(sortedOverdue.length)} showClock>
            {selectedEventId != null && sortedOverdue.length > 0 && (
              <div className="column-list">
                {sortedOverdue.map((subtask) => (
                  <SubtaskCard key={subtask.subtask_id} subtask={subtask} onOpen={setDetailSubtask} overdue />
                ))}
              </div>
            )}
            {selectedEventId != null && subtasks.length > 0 && sortedOverdue.length === 0 && (
              <p className="column-empty-hint">Sin gestiones vencidas.</p>
            )}
          </TaskColumn>
        </section>
      )}

      <button className="help-button" type="button" aria-label="Ayuda">
        <img src={helpRing} alt="" />
      </button>

      {isFormOpen && (
        <EventFormModal key={formKey} onClose={() => setIsFormOpen(false)} onCreated={handleEventCreated} />
      )}

      {isSubtaskFormOpen && selectedEvent && (
        <SubtaskFormModal
          key={subtaskFormKey}
          eventId={selectedEvent.eid}
          eventName={selectedEvent.name}
          eventDueDate={selectedEvent.due_date}
          onClose={() => setIsSubtaskFormOpen(false)}
          onCreated={handleSubtaskCreated}
        />
      )}

      {detailSubtask && <SubtaskDetailModal subtask={detailSubtask} onClose={() => setDetailSubtask(null)} />}
    </main>
  );
}

function TaskColumn({
  title,
  count,
  countClass,
  showClock = false,
  children,
}: {
  title: string;
  count: string;
  countClass: string;
  showClock?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article className={`task-column${title === "Para Hoy" ? " task-column--today" : ""}`}>
      <div className="column-heading">
        <div className="column-title">
          <h2>{title}</h2>
          {showClock && <ClockIcon muted={title === "Vencidas"} />}
        </div>
        <span className={`task-count ${countClass}`}>{count}</span>
      </div>
      <div className="column-body">{children}</div>
    </article>
  );
}

function TodayPanel({
  label,
  dotColor,
  countBg,
  countText,
  items,
  emptyHint,
  onOpen,
  completed = false,
}: {
  label: string;
  dotColor: string;
  countBg: string;
  countText: string;
  items: Subtask[];
  emptyHint: string;
  onOpen: (subtask: Subtask) => void;
  completed?: boolean;
}) {
  return (
    <div className="today-panel">
      <div className="today-panel-header">
        <div className="today-panel-title">
          <span aria-hidden="true" className="today-panel-dot" style={{ backgroundColor: dotColor }} />
          <span>{label}</span>
        </div>
        <span className="today-panel-count" style={{ backgroundColor: countBg, color: countText }}>
          {items.length}
        </span>
      </div>
      <div className="today-panel-body">
        {items.length === 0 ? (
          <p className="column-empty-hint">{emptyHint}</p>
        ) : (
          items.map((subtask) => (
            <SubtaskCard key={subtask.subtask_id} subtask={subtask} onOpen={onOpen} completed={completed} />
          ))
        )}
      </div>
    </div>
  );
}
