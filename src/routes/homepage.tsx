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
import { ConfirmDialog } from "../components/confirm-dialog";
import { apiFetch, ApiError, setSubtaskStatus } from "../lib/api";
import { todayLocalDateString } from "../lib/dates";
import { sortSubtasksByDateThenHours } from "../lib/subtask-display";
import { describeSaveError } from "../lib/subtask-errors";
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

// subtaskCount es null cuando las gestiones del evento a borrar no están
// (todavía) cargadas y confiables (subtasksStatus !== "ready"): en vez de
// arriesgar un número desfasado, se usa un texto genérico.
function eventDeleteDescription(event: Event, subtaskCount: number | null): string {
  const base = `¿Eliminar el evento «${event.name}»?`;
  if (subtaskCount === null) {
    return `${base} Se eliminarán también todas sus gestiones. Esta acción no se puede deshacer.`;
  }
  if (subtaskCount === 0) return `${base} Esta acción no se puede deshacer.`;
  const consequence =
    subtaskCount === 1
      ? "Se eliminará también su gestión."
      : `Se eliminarán también sus ${subtaskCount} gestiones.`;
  return `${base} ${consequence} Esta acción no se puede deshacer.`;
}

function subtaskDeleteDescription(subtask: Subtask): string {
  return `¿Eliminar la gestión «${subtask.title}»? Esta acción no se puede deshacer.`;
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
  const [eventsStatus, setEventsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [eventsError, setEventsError] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  // Sube en cada apertura para forzar un montaje limpio de EventFormModal /
  // SubtaskFormModal (defaultValues frescos y fetch de tipos/categorías sin
  // depender de un reset() en efecto).
  const [formKey, setFormKey] = useState(0);
  // Evento en edición; null significa que el formulario está en modo creación.
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = useState(false);
  const [subtaskFormKey, setSubtaskFormKey] = useState(0);
  const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);
  const [detailSubtask, setDetailSubtask] = useState<Subtask | null>(null);

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtasksStatus, setSubtasksStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [subtasksError, setSubtasksError] = useState("");

  const [deleteEventTarget, setDeleteEventTarget] = useState<Event | null>(null);
  const [deleteEventBusy, setDeleteEventBusy] = useState(false);
  const [deleteEventError, setDeleteEventError] = useState<string | null>(null);

  const [deleteSubtaskTarget, setDeleteSubtaskTarget] = useState<Subtask | null>(null);
  const [deleteSubtaskBusy, setDeleteSubtaskBusy] = useState(false);
  const [deleteSubtaskError, setDeleteSubtaskError] = useState<string | null>(null);
  // Tras borrar una gestión, la tarjeta que abrió el flujo (y el trigger que
  // ConfirmDialog intenta reenfocar al cerrar) ya no existe en el DOM: el
  // foco se cae a <body>. Se pide explícitamente en un efecto (para que
  // corra ya con el DOM actualizado) hacia un destino estable.
  const [focusAfterSubtaskDelete, setFocusAfterSubtaskDelete] = useState(false);
  const createTaskButtonRef = useRef<HTMLButtonElement>(null);
  const todayColumnHeadingRef = useRef<HTMLHeadingElement>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  // Completar/despausar una gestión (US-09): actualización optimista con
  // reversión si el PATCH falla (servidor caído, sin internet, 404 porque el
  // backend real todavía no tiene el endpoint, etc.). `pendingToggleId`
  // deshabilita el control mientras la petición está en curso, para evitar
  // dobles clics; `toggleError` guarda el mensaje y a qué gestión reintentarle.
  const [pendingToggleId, setPendingToggleId] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<{ subtaskId: number; message: string; retry: () => void } | null>(
    null
  );

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

  async function loadEvents() {
    setEventsStatus("loading");
    try {
      const data = await apiFetch<Event[]>("/eventos/");
      setEvents(data);
      setEventsStatus("ready");
    } catch (err) {
      setEventsError(err instanceof ApiError ? err.message : "No pudimos cargar tus eventos.");
      setEventsStatus("error");
    }
  }

  useEffect(() => {
    loadEvents();
    // Solo al montar: la recarga manual usa el botón "Reintentar" del menú.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setEditingEvent(null);
    setFormKey((key) => key + 1);
    setIsFormOpen(true);
  }

  function openEditEventForm(event: Event) {
    setEditingEvent(event);
    setFormKey((key) => key + 1);
    setIsFormOpen(true);
  }

  function openSubtaskForm() {
    setEditingSubtask(null);
    setSubtaskFormKey((key) => key + 1);
    setIsSubtaskFormOpen(true);
  }

  function openEditSubtaskForm(subtask: Subtask) {
    setDetailSubtask(null);
    setEditingSubtask(subtask);
    setSubtaskFormKey((key) => key + 1);
    setIsSubtaskFormOpen(true);
  }

  function handleEventCreated(event: Event) {
    setIsFormOpen(false);
    setEvents((prev) => [event, ...prev.filter((item) => item.eid !== event.eid)]);
    handleSelectEvent(event);
    showSuccess("Evento creado exitosamente");
  }

  function handleEventUpdated(event: Event) {
    setIsFormOpen(false);
    setEditingEvent(null);
    setEvents((prev) => prev.map((item) => (item.eid === event.eid ? event : item)));
    showSuccess("Cambios guardados");
  }

  function requestDeleteEvent(event: Event) {
    setDeleteEventError(null);
    setDeleteEventTarget(event);
  }

  async function confirmDeleteEvent() {
    if (deleteEventBusy || !deleteEventTarget) return;
    setDeleteEventBusy(true);
    setDeleteEventError(null);
    try {
      await apiFetch<void>(`/eventos/${deleteEventTarget.eid}/`, { method: "DELETE" });
      setEvents((prev) => prev.filter((event) => event.eid !== deleteEventTarget.eid));
      if (selectedEventId === deleteEventTarget.eid) handleSelectEvent(null);
      setDeleteEventTarget(null);
      showSuccess("Evento eliminado");
    } catch (err) {
      setDeleteEventError(err instanceof ApiError ? err.message : "No pudimos eliminar el evento.");
    } finally {
      setDeleteEventBusy(false);
    }
  }

  function cancelDeleteEvent() {
    if (deleteEventBusy) return;
    setDeleteEventTarget(null);
    setDeleteEventError(null);
  }

  function handleSubtaskUpdated(subtask: Subtask) {
    setIsSubtaskFormOpen(false);
    setEditingSubtask(null);
    setSubtasks((prev) => prev.map((item) => (item.subtask_id === subtask.subtask_id ? subtask : item)));
    showSuccess("Cambios guardados");
  }

  function applySubtaskUpdate(updated: Subtask) {
    setSubtasks((prev) => prev.map((item) => (item.subtask_id === updated.subtask_id ? updated : item)));
    setDetailSubtask((prev) => (prev && prev.subtask_id === updated.subtask_id ? updated : prev));
  }

  async function handleToggleComplete(subtask: Subtask) {
    if (pendingToggleId === subtask.subtask_id) return; // ya hay un cambio en curso para esta gestión: evita dobles clics
    const nextStatus: SubtaskStatus = subtask.status === "done" ? "pending" : "done";

    setToggleError(null);
    setPendingToggleId(subtask.subtask_id);
    applySubtaskUpdate({ ...subtask, status: nextStatus }); // optimista

    try {
      const updated = await setSubtaskStatus(subtask.subtask_id, nextStatus);
      applySubtaskUpdate(updated);
    } catch (err) {
      applySubtaskUpdate(subtask); // revierte al estado anterior a la petición
      setToggleError({
        subtaskId: subtask.subtask_id,
        message: describeSaveError(err),
        retry: () => handleToggleComplete(subtask),
      });
    } finally {
      setPendingToggleId((current) => (current === subtask.subtask_id ? null : current));
    }
  }

  function requestDeleteSubtask(subtask: Subtask) {
    setDetailSubtask(null);
    setDeleteSubtaskError(null);
    setDeleteSubtaskTarget(subtask);
  }

  async function confirmDeleteSubtask() {
    if (deleteSubtaskBusy || !deleteSubtaskTarget) return;
    setDeleteSubtaskBusy(true);
    setDeleteSubtaskError(null);
    try {
      await apiFetch<void>(`/subtareas/${deleteSubtaskTarget.subtask_id}/`, { method: "DELETE" });
      setSubtasks((prev) => prev.filter((subtask) => subtask.subtask_id !== deleteSubtaskTarget.subtask_id));
      setDeleteSubtaskTarget(null);
      setFocusAfterSubtaskDelete(true);
      showSuccess("Gestión eliminada");
    } catch (err) {
      setDeleteSubtaskError(err instanceof ApiError ? err.message : "No pudimos eliminar la gestión.");
    } finally {
      setDeleteSubtaskBusy(false);
    }
  }

  // Corre después de que React ya actualizó el DOM tras el borrado (la
  // tarjeta desapareció y ConfirmDialog se cerró), así que los refs reflejan
  // el estado final: el botón "Crear gestión" si sigue visible, si no el
  // encabezado de la columna "Para Hoy".
  useEffect(() => {
    if (!focusAfterSubtaskDelete) return;
    (createTaskButtonRef.current ?? todayColumnHeadingRef.current)?.focus();
    setFocusAfterSubtaskDelete(false);
  }, [focusAfterSubtaskDelete]);

  function cancelDeleteSubtask() {
    if (deleteSubtaskBusy) return;
    setDeleteSubtaskTarget(null);
    setDeleteSubtaskError(null);
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
      if (subtask.status !== "done") upcoming.push(subtask);
    } else if (subtask.scheduled_date === todayDate) {
      (subtask.status === "done" ? todayDone : todayPending).push(subtask);
    } else if (subtask.status !== "done") {
      overdue.push(subtask);
    }
    // Completada con fecha distinta a hoy (antes o después): no cae en
    // ninguna columna (Vencidas y Próximas excluyen "done"; Para hoy exige
    // fecha == hoy). Así, al marcar como completada una gestión vencida o
    // próxima (US-09), sale de su columna en vez de quedar mostrada ahí con
    // el check activado. Si en el futuro se necesita ver ese historial, hay
    // que decidir dónde mostrarlo.
  }

  const sortedUpcoming = sortSubtasksByDateThenHours(upcoming);
  const sortedTodayPending = sortSubtasksByDateThenHours(todayPending);
  const sortedTodayDone = sortSubtasksByDateThenHours(todayDone);
  const sortedOverdue = sortSubtasksByDateThenHours(overdue);

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

      {toggleError && toggleError.subtaskId !== detailSubtask?.subtask_id && (
        <div
          role="alert"
          className="mx-6 flex items-center justify-between gap-3 rounded-lg bg-[#fff0f0] px-4 py-3 text-[13px] text-[#8b1a1a]"
        >
          <span>{toggleError.message}</span>
          <div className="flex shrink-0 gap-3">
            <button type="button" onClick={toggleError.retry} className="font-jost text-[12px] underline">
              Reintentar
            </button>
            <button type="button" onClick={() => setToggleError(null)} className="font-jost text-[12px] underline">
              Cerrar
            </button>
          </div>
        </div>
      )}

      <section className="planner-intro" aria-labelledby="today-heading">
        <div className="intro-row">
          <h1 id="today-heading">Hoy <SunIcon /></h1>
          <div className="intro-actions">
            {selectedEventId != null && subtasksStatus === "ready" && subtasks.length > 0 && (
              <button
                ref={createTaskButtonRef}
                type="button"
                className="create-task-button create-task-button--compact"
                onClick={openSubtaskForm}
              >
                Crear gestión <Plus aria-hidden="true" size={16} />
              </button>
            )}
            <EventMenu
              events={events}
              status={eventsStatus}
              errorMessage={eventsError}
              onRetry={loadEvents}
              selectedEventId={selectedEventId}
              onSelect={handleSelectEvent}
              onCreateNew={openCreateForm}
              onEditEvent={openEditEventForm}
              onDeleteEvent={requestDeleteEvent}
            />
          </div>
        </div>

        <div className="filter-row" aria-label="Filtros de gestiones">
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
        <section className="task-columns" aria-label="Gestiones del día">
          <TaskColumn title="Próximas" countClass="count--blue" count={String(sortedUpcoming.length)} showClock>
            {selectedEventId != null && sortedUpcoming.length > 0 && (
              <div className="column-list">
                {sortedUpcoming.map((subtask) => (
                  <SubtaskCard
                    key={subtask.subtask_id}
                    subtask={subtask}
                    onOpen={setDetailSubtask}
                    onToggleComplete={handleToggleComplete}
                    pending={pendingToggleId === subtask.subtask_id}
                  />
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
            headingRef={todayColumnHeadingRef}
          >
            {selectedEventId == null ? (
              <div className="column-empty-wrap">
                <div className="empty-state">
                  <p>
                    Aún no tienes gestiones
                    <br />
                    ¡Crea una nueva!
                  </p>
                  <button className="create-task-button" type="button" onClick={openCreateForm}>
                    Crear gestión <Plus aria-hidden="true" size={22} />
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
                    Crear gestión <Plus aria-hidden="true" size={22} />
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
                  onToggleComplete={handleToggleComplete}
                  pendingToggleId={pendingToggleId}
                />
                <TodayPanel
                  label="Completadas"
                  dotColor="#00d492"
                  countBg="#ecfdf5"
                  countText="#007a55"
                  items={sortedTodayDone}
                  emptyHint="Sin gestiones completadas."
                  onOpen={setDetailSubtask}
                  onToggleComplete={handleToggleComplete}
                  pendingToggleId={pendingToggleId}
                  completed
                />
              </div>
            )}
          </TaskColumn>

          <TaskColumn title="Vencidas" countClass="count--red" count={String(sortedOverdue.length)} showClock>
            {selectedEventId != null && sortedOverdue.length > 0 && (
              <div className="column-list">
                {sortedOverdue.map((subtask) => (
                  <SubtaskCard
                    key={subtask.subtask_id}
                    subtask={subtask}
                    onOpen={setDetailSubtask}
                    onToggleComplete={handleToggleComplete}
                    pending={pendingToggleId === subtask.subtask_id}
                    overdue
                  />
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
        <EventFormModal
          key={formKey}
          initialValues={editingEvent ?? undefined}
          onClose={() => {
            setIsFormOpen(false);
            setEditingEvent(null);
          }}
          onCreated={handleEventCreated}
          onUpdated={handleEventUpdated}
        />
      )}

      {isSubtaskFormOpen && selectedEvent && (
        <SubtaskFormModal
          key={subtaskFormKey}
          eventId={selectedEvent.eid}
          eventName={selectedEvent.name}
          eventDueDate={selectedEvent.due_date}
          initialValues={editingSubtask ?? undefined}
          onClose={() => {
            setIsSubtaskFormOpen(false);
            setEditingSubtask(null);
          }}
          onCreated={handleSubtaskCreated}
          onUpdated={handleSubtaskUpdated}
        />
      )}

      {detailSubtask && (
        <SubtaskDetailModal
          subtask={detailSubtask}
          onClose={() => setDetailSubtask(null)}
          onEdit={openEditSubtaskForm}
          onDelete={requestDeleteSubtask}
          onToggleComplete={handleToggleComplete}
          togglePending={pendingToggleId === detailSubtask.subtask_id}
          toggleError={
            toggleError && toggleError.subtaskId === detailSubtask.subtask_id
              ? { message: toggleError.message, onRetry: toggleError.retry }
              : null
          }
        />
      )}

      <ConfirmDialog
        open={deleteEventTarget != null}
        title="Eliminar evento"
        description={
          deleteEventTarget
            ? eventDeleteDescription(deleteEventTarget, subtasksStatus === "ready" ? subtasks.length : null)
            : ""
        }
        busy={deleteEventBusy}
        error={deleteEventError}
        onConfirm={confirmDeleteEvent}
        onCancel={cancelDeleteEvent}
      />

      <ConfirmDialog
        open={deleteSubtaskTarget != null}
        title="Eliminar gestión"
        description={deleteSubtaskTarget ? subtaskDeleteDescription(deleteSubtaskTarget) : ""}
        busy={deleteSubtaskBusy}
        error={deleteSubtaskError}
        onConfirm={confirmDeleteSubtask}
        onCancel={cancelDeleteSubtask}
      />
    </main>
  );
}

function TaskColumn({
  title,
  count,
  countClass,
  showClock = false,
  headingRef,
  children,
}: {
  title: string;
  count: string;
  countClass: string;
  showClock?: boolean;
  /** Destino de foco estable (ej. tras borrar una gestión); necesita tabIndex=-1 porque un h2 no es focuseable por defecto. */
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  children?: React.ReactNode;
}) {
  return (
    <article className={`task-column${title === "Para Hoy" ? " task-column--today" : ""}`}>
      <div className="column-heading">
        <div className="column-title">
          <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
            {title}
          </h2>
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
  onToggleComplete,
  pendingToggleId,
  completed = false,
}: {
  label: string;
  dotColor: string;
  countBg: string;
  countText: string;
  items: Subtask[];
  emptyHint: string;
  onOpen: (subtask: Subtask) => void;
  onToggleComplete: (subtask: Subtask) => void;
  pendingToggleId: number | null;
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
            <SubtaskCard
              key={subtask.subtask_id}
              subtask={subtask}
              onOpen={onOpen}
              onToggleComplete={onToggleComplete}
              pending={pendingToggleId === subtask.subtask_id}
              completed={completed}
            />
          ))
        )}
      </div>
    </div>
  );
}
