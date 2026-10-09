import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Plus } from "lucide-react";
import calendarIcon from "../assets/calendar-icon.svg";
import helpRing from "../assets/help-ring.svg";
import { AccountMenu } from "../components/account-menu";
import { DayProgressBar } from "../components/day-progress-bar";
import { EventMenu } from "../components/event-menu";
import { EventsView } from "../components/events-view";
import { EventFormModal } from "../components/event-form-modal";
import { EventWizard } from "../components/event-wizard";
import { SubtaskFormModal } from "../components/subtask-form-modal";
import { SubtaskWizard } from "../components/subtask-wizard";
import { SubtaskDetailModal } from "../components/subtask-detail-modal";
import { ReprogramModal } from "../components/reprogram-modal";
import { SubtaskCard } from "../components/subtask-card";
import { ConfirmDialog } from "../components/confirm-dialog";
import { ViewSwitcher, type ViewSwitcherValue } from "../components/view-switcher";
import { apiFetch, ApiError, setSubtaskStatus } from "../lib/api";
import { useAuth } from "../lib/auth";
import { creationMessage } from "../lib/success-messages";
import { sortCompletedSubtasksByDateDesc, sortSubtasksByDateThenHours } from "../lib/subtask-display";
import { describeSaveError } from "../lib/subtask-errors";
import type { Event, Subtask, SubtaskStatus, TodaySummary } from "../lib/types";
import "./homepage.css";

// Solo un entero positivo es un eid válido; cualquier otro valor de
// ?evento= (vacío, texto, decimales) se trata como "sin selección".
const EVENT_ID_PATTERN = /^\d+$/;

function findSubtaskInToday(summary: TodaySummary | null, subtaskId: number): Subtask | undefined {
  if (!summary) return undefined;
  return (
    summary.vencidas.find((item) => item.subtask_id === subtaskId) ??
    summary.para_hoy.pendientes.find((item) => item.subtask_id === subtaskId) ??
    summary.para_hoy.completadas.find((item) => item.subtask_id === subtaskId) ??
    summary.proximas.find((item) => item.subtask_id === subtaskId)
  );
}

// PIM1-11 (corrección del profesor): Vencidas debe ser el ícono más
// prominente de los tres, no el más apagado. Antes `urgent` se llamaba
// `muted` y se aplicaba igual a Vencidas, pero con un estilo "atenuado"
// (border-color: #e99b9b, más claro que el gris neutro de Próximas) —
// justo al revés de la jerarquía de urgencia que pide la vista Hoy.
function ClockIcon({ urgent = false }: { urgent?: boolean }) {
  return <span aria-hidden="true" className={`clock-icon${urgent ? " clock-icon--urgent" : ""}`} />;
}

// Antes mostraba el número real de gestiones del evento; desde PIM1-55 ya no
// hay de dónde sacarlo de forma confiable (/api/hoy/ solo trae vencidas/hoy/
// próximas, una ventana de fecha, no el total real del evento), así que
// queda el texto genérico.
function eventDeleteDescription(event: Event): string {
  return `¿Eliminar el evento «${event.name}»? Se eliminarán también todas sus gestiones. Esta acción no se puede deshacer.`;
}

function subtaskDeleteDescription(subtask: Subtask): string {
  return `¿Eliminar la gestión «${subtask.title}»? Esta acción no se puede deshacer.`;
}

export function HomePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState<Event[]>([]);
  const [eventsStatus, setEventsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [eventsError, setEventsError] = useState("");

  // isFormOpen/editingEvent: EventFormModal en modo edición (PIM1-117 lo
  // sacó de la creación, ver EventWizard más abajo) — siempre se abre con
  // editingEvent ya puesto, nunca en modo "create".
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Sube en cada apertura para forzar un montaje limpio de EventFormModal /
  // SubtaskFormModal (defaultValues frescos y fetch de tipos/categorías sin
  // depender de un reset() en efecto).
  const [formKey, setFormKey] = useState(0);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardKey, setWizardKey] = useState(0);

  // isSubtaskFormOpen/editingSubtask: SubtaskFormModal en modo edición
  // (PIM1-117 sacó la creación de acá, ver SubtaskWizard más abajo) —
  // siempre se abre con editingSubtask ya puesto.
  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = useState(false);
  const [subtaskFormKey, setSubtaskFormKey] = useState(0);
  const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);
  const [detailSubtask, setDetailSubtask] = useState<Subtask | null>(null);
  // Sprint 3 / C1: ReprogramModal, separado de SubtaskFormModal porque es un
  // popup más chico (solo fecha y duración) y reutiliza los campos del
  // Wizard de creación en vez del formulario completo.
  const [reprogrammingSubtask, setReprogrammingSubtask] = useState<Subtask | null>(null);

  const [isSubtaskWizardOpen, setIsSubtaskWizardOpen] = useState(false);
  const [subtaskWizardKey, setSubtaskWizardKey] = useState(0);
  // Evento dueño de la gestión que se va a crear: por defecto el seleccionado
  // en Hoy (donde vive la mayoría de los triggers de "Crear gestión"), pero
  // "Crear gestión" desde la vista expandida de un evento en la pestaña
  // Eventos lo pisa con ESE evento — puede ser distinto del seleccionado en
  // Hoy (o no haber ninguno seleccionado ahí).
  const [subtaskWizardEvent, setSubtaskWizardEvent] = useState<Event | null>(null);

  // PIM1-55: GET /api/hoy/ ya trae vencidas/para_hoy/proximas agrupadas y
  // ordenadas por evento (o agregadas entre todos si no hay `event_id`), más
  // progreso_dia — reemplaza el fetch por evento + agrupar en el cliente que
  // había antes. `metric` es el toggle Gestiones/Horas de la barra de
  // progreso: puramente local, progreso_dia ya trae ambas métricas siempre.
  const [today, setToday] = useState<TodaySummary | null>(null);
  const [todayStatus, setTodayStatus] = useState<"loading" | "ready" | "error">("loading");
  const [todayError, setTodayError] = useState("");
  const [metric, setMetric] = useState<"gestiones" | "horas">("gestiones");

  // EventsView mantiene su propio fetch por evento (progressByEvent), separado
  // de `today` (que solo cubre la ventana vencidas/hoy/próximas de Hoy). Sin
  // esto, crear/editar/borrar/completar una gestión no se reflejaba en las 4
  // tablas de la vista expandida de Eventos hasta recargar la página: se le
  // pasa como prop y cada bump fuerza su refetch.
  const [subtasksVersion, setSubtasksVersion] = useState(0);

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
  // backend real todavía no tiene el endpoint, etc.). `pendingToggleIds` es
  // un Set (no un solo id): así alternar la gestión A mientras la B sigue en
  // vuelo no pisa el estado "pendiente" de A, y cada control se deshabilita
  // de forma independiente. `toggleError` guarda el mensaje y a qué gestión
  // reintentarle.
  const [pendingToggleIds, setPendingToggleIds] = useState<Set<number>>(() => new Set());
  const [toggleError, setToggleError] = useState<{ subtaskId: number; message: string; retry: () => void } | null>(
    null
  );
  // Espejo mutable de `today` (no dispara renders), para que el cierre de
  // "Reintentar" -creado en el momento del fallo- lea el estado más reciente
  // de la gestión al reintentar, en vez de la foto vieja que tenía cuando se
  // creó el cierre.
  const todayRef = useRef<TodaySummary | null>(today);
  todayRef.current = today;

  // PIM1-59: controller de la carga de /api/hoy/ en vuelo. Al cambiar de
  // evento rápido (A->B antes de que A responda), se aborta A en vez de
  // solo ignorar su respuesta tardía: evita pintar datos viejos Y evita que
  // una petición ya descartada siga ocupando ancho de banda/backend.
  const todayAbortRef = useRef<AbortController | null>(null);

  const eventoParam = searchParams.get("evento");
  const selectedEventId = eventoParam && EVENT_ID_PATTERN.test(eventoParam) ? Number(eventoParam) : null;
  const selectedEvent = events.find((event) => event.eid === selectedEventId) ?? null;
  // PIM1-117: SubtaskFormModal (isSubtaskFormOpen) ahora es solo edición (la
  // creación pasó al SubtaskWizard, ver más abajo) — siempre se abre con
  // editingSubtask ya puesto. Resuelve por el `eid` de la propia gestión, no
  // por selectedEvent: si se abrió desde la tabla de un evento en la
  // pestaña Eventos, selectedEvent puede ser otro evento (o ninguno).
  const subtaskFormEvent = editingSubtask
    ? (events.find((event) => event.eid === editingSubtask.eid) ?? null)
    : null;

  // Mismo criterio que subtaskFormEvent: resuelve por el `eid` de la propia
  // gestión, no por selectedEvent.
  const reprogramEvent = reprogrammingSubtask
    ? (events.find((event) => event.eid === reprogrammingSubtask.eid) ?? null)
    : null;

  // ?vista=eventos|hoy, igual que ?evento=; "hoy" es el valor por defecto
  // (cualquier otro valor que no sea "eventos" cae en "hoy") — PIM1-11: esta
  // vista siempre fue la de "Hoy", así que es la que debe verse sin tocar nada.
  const vistaParam = searchParams.get("vista");
  const currentView: ViewSwitcherValue = vistaParam === "eventos" ? "eventos" : "hoy";

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

  // event_id es opcional en /api/hoy/: sin él, agrega entre todos los
  // eventos del organizador (antes "Todos los eventos" en Hoy no traía datos
  // reales — este es justo el fetch que faltaba).
  async function loadToday(eventId: number | null) {
    todayAbortRef.current?.abort();
    const controller = new AbortController();
    todayAbortRef.current = controller;

    setTodayStatus("loading");
    setTodayError("");
    try {
      const query = eventId != null ? `?event_id=${eventId}` : "";
      const data = await apiFetch<TodaySummary>(`/hoy/${query}`, { signal: controller.signal });
      if (todayAbortRef.current !== controller) return; // ya se abortó por una carga más nueva
      setToday(data);
      setTodayStatus("ready");
    } catch (err) {
      if (todayAbortRef.current !== controller) return;
      // Un abort propio no es un error real: no hay nada que mostrar, la
      // carga que lo reemplazó ya está resolviendo su propio estado.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setTodayError(err instanceof ApiError ? err.message : "No pudimos cargar las gestiones de hoy.");
      setTodayStatus("error");
    }
  }

  useEffect(() => {
    loadToday(selectedEventId);
    // Solo cuando cambia el evento seleccionado: la recarga manual usa "Reintentar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  function showSuccess(message: string) {
    setSuccessMessage(message);
    if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = window.setTimeout(() => setSuccessMessage(null), 5000);
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

  // Conserva ?evento= al cambiar de vista, así volver a "Hoy" mantiene el
  // mismo evento seleccionado.
  function handleSelectView(view: ViewSwitcherValue) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (view === "hoy") next.delete("vista");
        else next.set("vista", view);
        return next;
      },
      { replace: true }
    );
  }

  // PIM1-117: "Crear Evento" abre el wizard (ver EventWizard), no
  // EventFormModal — ese modal sigue siendo el flujo de edición (abajo).
  function openCreateForm() {
    setWizardKey((key) => key + 1);
    setIsWizardOpen(true);
  }

  function closeWizard() {
    setIsWizardOpen(false);
  }

  function openEditEventForm(event: Event) {
    setEditingEvent(event);
    setFormKey((key) => key + 1);
    setIsFormOpen(true);
  }

  // PIM1-117: "Crear gestión" abre el wizard (ver SubtaskWizard), no
  // SubtaskFormModal — ese modal sigue siendo el flujo de edición (abajo).
  // Sin `event` (triggers de Hoy), el evento dueño es el seleccionado ahí;
  // con `event` (trigger desde la vista expandida de Eventos), ese evento
  // manda sin importar qué esté seleccionado en Hoy.
  function openSubtaskForm(event?: Event) {
    setSubtaskWizardEvent(event ?? selectedEvent);
    setSubtaskWizardKey((key) => key + 1);
    setIsSubtaskWizardOpen(true);
  }

  function closeSubtaskWizard() {
    setIsSubtaskWizardOpen(false);
  }

  function openEditSubtaskForm(subtask: Subtask) {
    setDetailSubtask(null);
    setEditingSubtask(subtask);
    setSubtaskFormKey((key) => key + 1);
    setIsSubtaskFormOpen(true);
  }

  function openReprogramSubtask(subtask: Subtask) {
    setDetailSubtask(null);
    setReprogrammingSubtask(subtask);
  }

  function handleSubtaskReprogrammed() {
    setReprogrammingSubtask(null);
    loadToday(selectedEventId);
    setSubtasksVersion((version) => version + 1);
    showSuccess("Gestión reprogramada");
  }

  function handleEventCreated(event: Event) {
    setIsFormOpen(false);
    setEvents((prev) => [event, ...prev.filter((item) => item.eid !== event.eid)]);
    handleSelectEvent(event);
    showSuccess(creationMessage("event", event.name));
  }

  // PIM1-117: igual que handleEventCreated, pero sin tocar isFormOpen (el
  // wizard tiene su propio estado, ver isWizardOpen) — se llama apenas el
  // wizard crea el evento de verdad (stage "¿Para quién?"), no al cerrarlo,
  // así que el evento ya aparece seleccionado mientras el usuario sigue
  // agregando gestiones en la stage de plan inicial.
  function handleWizardEventCreated(event: Event) {
    setEvents((prev) => [event, ...prev.filter((item) => item.eid !== event.eid)]);
    handleSelectEvent(event);
    showSuccess(creationMessage("event", event.name));
  }

  // Gestiones agregadas desde la stage de plan inicial del wizard: mismo
  // refresco que handleSubtaskCreated, sin el toast (una por gestión sería
  // ruidoso mientras se arma el plan inicial de varias seguidas).
  function handleWizardSubtaskCreated() {
    loadToday(selectedEventId);
    setSubtasksVersion((version) => version + 1);
  }

  function handleEventUpdated(event: Event) {
    setIsFormOpen(false);
    setEditingEvent(null);
    setEvents((prev) => prev.map((item) => (item.eid === event.eid ? event : item)));
    showSuccess("Cambios guardados");
  }

  // PIM1-120: EventCover ya hizo el PATCH y trae el evento actualizado; acá
  // solo se sincroniza el estado, sin los efectos de handleEventUpdated
  // (cerrar EventFormModal, limpiar editingEvent) que no aplican para este
  // flujo.
  function handleEventCoverUpdated(event: Event) {
    setEvents((prev) => prev.map((item) => (item.eid === event.eid ? event : item)));
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

  function handleSubtaskUpdated() {
    setIsSubtaskFormOpen(false);
    setEditingSubtask(null);
    loadToday(selectedEventId);
    setSubtasksVersion((version) => version + 1);
    showSuccess("Cambios guardados");
  }

  function addPendingToggle(subtaskId: number) {
    setPendingToggleIds((prev) => {
      const next = new Set(prev);
      next.add(subtaskId);
      return next;
    });
  }

  function removePendingToggle(subtaskId: number) {
    setPendingToggleIds((prev) => {
      if (!prev.has(subtaskId)) return prev;
      const next = new Set(prev);
      next.delete(subtaskId);
      return next;
    });
  }

  // Sin flip optimista: el estado de una gestión ahora vive repartido en 4
  // arreglos separados (vencidas/para_hoy.pendientes/completadas/proximas),
  // y completarla puede sacarla de un grupo sin que quede en ningún otro
  // (ej. una vencida marcada como hecha ya no es "de hoy", así que
  // desaparece de esta vista — se sigue viendo en la tabla del evento en
  // Eventos). Mover la tarjeta a ciegas antes de saber el resultado real
  // sería más complicado y menos confiable que solo deshabilitar el
  // checkbox (pendingToggleIds) mientras se resuelve el PATCH y recargar
  // /api/hoy/ al terminar.
  async function handleToggleComplete(subtask: Subtask) {
    const subtaskId = subtask.subtask_id;
    if (pendingToggleIds.has(subtaskId)) return; // ya hay un cambio en curso para esta gestión: evita dobles clics

    // Se lee del espejo mutable (no del `subtask` recibido, que puede ser una
    // foto vieja si esta llamada viene de un cierre de "Reintentar" creado
    // antes de otros cambios) para partir siempre del estado real vigente.
    const current = findSubtaskInToday(todayRef.current, subtaskId) ?? subtask;
    const previousStatus = current.status;
    const nextStatus: SubtaskStatus = previousStatus === "done" ? "pending" : "done";

    setToggleError((prev) => (prev && prev.subtaskId === subtaskId ? null : prev));
    addPendingToggle(subtaskId);

    try {
      const updated = await setSubtaskStatus(subtaskId, nextStatus);
      setDetailSubtask((prev) => (prev && prev.subtask_id === subtaskId ? updated : prev));
      await loadToday(selectedEventId);
      setSubtasksVersion((version) => version + 1);
    } catch (err) {
      setToggleError({
        subtaskId,
        message: describeSaveError(err),
        retry: () => handleToggleComplete(subtask),
      });
    } finally {
      removePendingToggle(subtaskId);
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
      await loadToday(selectedEventId);
      setSubtasksVersion((version) => version + 1);
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
    showSuccess(`${creationMessage("subtask", subtask.title)}${extra}`);
    loadToday(selectedEventId);
    setSubtasksVersion((version) => version + 1);
  }

  // PIM1-117: igual que handleSubtaskCreated, pero sin tocar isSubtaskFormOpen
  // (el wizard tiene su propio estado, ver isSubtaskWizardOpen) y cerrando el
  // wizard de una vez: a diferencia del plan inicial de eventos, acá no hay
  // una stage siguiente a la que pasar.
  function handleSubtaskWizardCreated(subtask: Subtask, warnings?: string[]) {
    setIsSubtaskWizardOpen(false);
    const extra = warnings && warnings.length > 0 ? ` ${warnings.join(" ")}` : "";
    showSuccess(`${creationMessage("subtask", subtask.title)}${extra}`);
    loadToday(selectedEventId);
    setSubtasksVersion((version) => version + 1);
  }

  // /api/hoy/ ya viene agrupado (vencidas/para_hoy/proximas) y filtrado por
  // organizador (y por evento, si hay uno seleccionado) — el reparto por
  // fecha que antes se hacía a mano acá ya no hace falta. Sí se reaplica el
  // orden fecha+horas del frontend (ver sortSubtasksByDateThenHours): el
  // backend ordena por scheduled_date/estimated_hours/subtask_id ascendente,
  // pero el desempate de horas de este producto es descendente (más esfuerzo
  // primero) — reordenar acá evita depender de que el backend replique
  // exactamente ese criterio.
  const sortedOverdue = today ? sortSubtasksByDateThenHours(today.vencidas) : [];
  const sortedTodayPending = today ? sortSubtasksByDateThenHours(today.para_hoy.pendientes) : [];
  // Nota de alcance (ver comentario en PIM1-55): a diferencia del
  // comportamiento anterior, esto solo trae completadas de HOY, no de
  // cualquier fecha — backend tiene en desarrollo un parámetro para
  // recuperar el comportamiento original.
  const sortedDone = today ? sortCompletedSubtasksByDateDesc(today.para_hoy.completadas) : [];
  // `proximas` solo cubre hasta hoy + dias_proximos (7 por defecto, ver
  // planning/views.py): una gestión agendada más adelante no aparece acá
  // aunque sí exista (se ve completa, sin ese recorte, en la vista expandida
  // de Eventos). La columna dice "Próximos 7 días" para que esto sea visible
  // en la UI en vez de parecer que la gestión "se perdió".
  const sortedUpcoming = today ? sortSubtasksByDateThenHours(today.proximas) : [];
  const totalCount = sortedOverdue.length + sortedTodayPending.length + sortedDone.length + sortedUpcoming.length;

  // Corrección del profesor (clínica de Sprint 1): sin eventos, ocultar todo
  // (selector, filtros, barra de progreso, columnas) y dejar solo un botón de
  // "Crear Evento" — ya aplicado en EventsView, faltaba acá. Antes, con cero
  // eventos, esta vista mostraba un botón "Crear gestión" que en realidad
  // creaba un evento primero: eso fue justo lo que confundió al profesor.
  // currentView === "hoy": el panel de Hoy se mantiene montado (con `hidden`)
  // incluso cuando la pestaña activa es "Eventos", así que sin este chequeo
  // este estado vacío "fantasma" duplicaría el texto/botón del estado vacío
  // propio de EventsView (mismo problema, visible solo para queries por
  // texto que no respetan `hidden`, pero evitable de raíz).
  const hasNoEvents = eventsStatus === "ready" && events.length === 0 && currentView === "hoy";

  return (
    <main className="planner-shell">
      <header className="planner-header">
        <div className="brand-lockup">
          <div className="brand-mark">
            <img src={calendarIcon} alt="" />
          </div>
          <span className="brand-name">PlanificApp</span>
        </div>

        {/* PIM1-11: reemplaza al label "Hoy — 17 sep. 2026" (el profesor lo
            señaló como poco útil) por el selector real de vista, que sí
            comunica algo — en qué pestaña está el usuario — y deja lista la
            barra superior para cuando se agregue el switcher Hoy/Eventos. */}
        <ViewSwitcher value={currentView} onChange={handleSelectView} />

        <AccountMenu />
      </header>

      <div aria-live="polite" role="status" className="success-toast" data-visible={Boolean(successMessage)}>
        <CheckCircle2 aria-hidden="true" size={16} />
        <span>{successMessage}</span>
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

      <div
        role="tabpanel"
        id="hoy-panel"
        aria-labelledby="hoy-tab"
        hidden={currentView !== "hoy"}
        className={hasNoEvents ? "flex flex-1 flex-col" : undefined}
      >
        {hasNoEvents ? (
          // .column-empty-wrap centraba con `flex: 1` contra un ancestro flex
          // (.column-body, dentro de .task-columns) que acá no existe: sin él
          // quedaba pegado arriba, justo debajo del header. Mismo patrón que
          // el estado vacío de EventsView (className de arriba + este div):
          // flex-1 + min-h como piso para que el grid de place-items:center
          // tenga contra qué centrar, usando el alto real disponible de la
          // página (planner-shell es flex-column), no un tamaño fijo.
          <div className="grid flex-1 min-h-[420px] place-items-center px-8">
            <div className="empty-state">
              <p>
                Aún no tienes eventos
                <br />
                ¡Crea uno nuevo!
              </p>
              <button className="create-task-button" type="button" onClick={openCreateForm}>
                Crear Evento <Plus aria-hidden="true" size={22} />
              </button>
            </div>
          </div>
        ) : (
          <>
        <section className="planner-intro" aria-labelledby="hoy-heading">
          <div className="intro-row">
            {/* PIM1-12: este heading reemplaza al antiguo "Plan inicial <icono>"
                (el profesor lo señaló como redundante: la pestaña ya indica en
                qué vista se está). Texto fijo: el selector de abajo ("Todos
                los eventos" o el nombre del evento) ya completa la oración. */}
            <h1 id="hoy-heading">Viendo gestiones de:</h1>
          </div>

          {/* PIM1-12: selector de evento grande y centrado, en vez del menú
              desplegable chico en la esquina que confundió al profesor en la
              clínica de Sprint 1 (pensó que las gestiones eran los eventos).
              El nombre del evento ya se lee en el propio selector, así que el
              heading de arriba no lo repite. */}
          <div className="event-selector-row">
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

          {/* Antes vivía arriba a la derecha (grid-column 3 de .intro-row),
              lejos del selector de evento al que corresponde. Debajo del
              selector queda claro para qué evento se está creando la
              gestión. */}
          {selectedEventId != null && todayStatus === "ready" && totalCount > 0 && (
            <div className="create-task-below-selector">
              <button
                ref={createTaskButtonRef}
                type="button"
                className="create-task-button create-task-button--compact"
                onClick={() => openSubtaskForm()}
              >
                Crear gestión <Plus aria-hidden="true" size={16} />
              </button>
            </div>
          )}
        </section>

        {todayStatus === "loading" && (
          <p role="status" className="subtasks-status">
            Cargando gestiones…
          </p>
        )}

        {todayStatus === "error" && (
          <div role="alert" className="subtasks-status subtasks-status--error">
            <p>{todayError}</p>
            <button type="button" onClick={() => loadToday(selectedEventId)}>
              Reintentar
            </button>
          </div>
        )}

        {todayStatus === "ready" && today && today.progreso_dia.total > 0 && (
          <div className="mx-8 mb-4">
            <DayProgressBar progress={today.progreso_dia} metric={metric} onMetricChange={setMetric} />
          </div>
        )}

        {todayStatus === "ready" && (
          <section className="task-columns" aria-label="Gestiones del día">
            <TaskColumn
              title="Vencidas"
              countClass="count--red"
              count={String(sortedOverdue.length)}
              showClock
              orderHint="En el grupo de gestiones vencidas se muestran primero las gestiones con fecha más antigua. Si hay varias gestiones en una misma fecha, se muestran primero las de mayor duración."
            >
              {sortedOverdue.length > 0 && (
                <div className="column-list">
                  {sortedOverdue.map((subtask) => (
                    <SubtaskCard
                      key={subtask.subtask_id}
                      subtask={subtask}
                      onOpen={setDetailSubtask}
                      onToggleComplete={handleToggleComplete}
                      pending={pendingToggleIds.has(subtask.subtask_id)}
                      overdue
                      eventName={subtask.event_name}
                    />
                  ))}
                </div>
              )}
              {totalCount > 0 && sortedOverdue.length === 0 && (
                <p className="column-empty-hint">Sin gestiones vencidas.</p>
              )}
            </TaskColumn>

            <TaskColumn
              title="Para Hoy"
              countClass="count--red"
              count={String(sortedTodayPending.length + sortedDone.length)}
              headingRef={todayColumnHeadingRef}
              orderHint="En el grupo de gestiones para hoy todas comparten la misma fecha, así que se muestran primero las de mayor duración."
            >
              {totalCount === 0 ? (
                selectedEventId == null ? (
                  <div className="column-empty-wrap">
                    <div className="empty-state">
                      <p className="empty-state-hint">
                        Sin gestiones vencidas, para hoy ni en los próximos 7 días.
                        <br />
                        ¿Buscas algo más lejano?{" "}
                        <button type="button" className="empty-state-link" onClick={() => handleSelectView("eventos")}>
                          Revisa Eventos
                        </button>
                        .
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="column-empty-wrap">
                    <div className="empty-state">
                      <p className="empty-state-hint">
                        Este evento no tiene gestiones vencidas, para hoy ni en los próximos 7 días.
                        <br />
                        ¿Buscas algo más lejano?{" "}
                        <button type="button" className="empty-state-link" onClick={() => handleSelectView("eventos")}>
                          Revisa Eventos
                        </button>
                        .
                      </p>
                      <button className="create-task-button" type="button" onClick={() => openSubtaskForm()}>
                        Crear gestión <Plus aria-hidden="true" size={22} />
                      </button>
                    </div>
                  </div>
                )
              ) : sortedTodayPending.length === 0 && sortedDone.length === 0 ? (
                // Hay gestiones (vencidas o próximas), pero ninguna agendada
                // para hoy puntualmente: antes esto se indicaba con un texto
                // chico en el lugar de la barra de progreso (DayProgressBar),
                // separado de esta columna — confuso, porque la columna
                // igual mostraba sus dos paneles (Pendientes/Completadas)
                // vacíos por separado. Un solo mensaje grande y centrado acá
                // reemplaza a los tres.
                <div className="column-empty-wrap">
                  <div className="empty-state">
                    <p>No hay tareas asignadas para hoy.</p>
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
                    pendingToggleIds={pendingToggleIds}
                  />
                  <TodayPanel
                    label="Completadas"
                    dotColor="#00d492"
                    countBg="#ecfdf5"
                    countText="#007a55"
                    items={sortedDone}
                    emptyHint="Sin gestiones completadas."
                    onOpen={setDetailSubtask}
                    onToggleComplete={handleToggleComplete}
                    pendingToggleIds={pendingToggleIds}
                    completed
                  />
                </div>
              )}
            </TaskColumn>

            <TaskColumn
              title="Próximos 7 días"
              countClass="count--blue"
              count={String(sortedUpcoming.length)}
              showClock
              orderHint="En el grupo de gestiones próximas se muestran primero las gestiones con fecha más cercana. Si hay varias gestiones en una misma fecha, se muestran primero las de mayor duración."
            >
              {sortedUpcoming.length > 0 && (
                <div className="column-list">
                  {sortedUpcoming.map((subtask) => (
                    <SubtaskCard
                      key={subtask.subtask_id}
                      subtask={subtask}
                      onOpen={setDetailSubtask}
                      onToggleComplete={handleToggleComplete}
                      pending={pendingToggleIds.has(subtask.subtask_id)}
                      eventName={subtask.event_name}
                    />
                  ))}
                </div>
              )}
              {totalCount > 0 && sortedUpcoming.length === 0 && (
                <p className="column-empty-hint">Sin gestiones en los próximos 7 días.</p>
              )}
            </TaskColumn>
          </section>
        )}
          </>
        )}
      </div>

      {/* HU-13/PIM1-111: listado de cards + vista expandida del evento (paso
          1: solo información). Las tablas de gestiones son el paso
          siguiente; ver el comentario de EventsView.
          flex flex-col flex-1 (junto con planner-shell ahora siendo
          flex-column, ver homepage.css): sin esto el panel solo medía lo que
          ocupaba su contenido y el roulette quedaba pegado arriba de la
          página en vez de centrado en el alto disponible de la pantalla.
          flex-col (no solo flex-1) es necesario porque el roulette usa
          `flex-1` para llenar este panel — un `height: 100%` ahí no
          funciona: la altura de este panel viene de flex-grow, no de un
          valor de `height` explícito, así que no cuenta como "definida"
          para que un hijo resuelva un porcentaje (confirmado con Claude in
          Chrome: `h-full` medía 420px en vez de estirarse). */}
      <div
        role="tabpanel"
        id="eventos-panel"
        aria-labelledby="eventos-tab"
        hidden={currentView !== "eventos"}
        className="flex flex-1 flex-col"
      >
        {currentView === "eventos" && (
          <EventsView
            events={events}
            status={eventsStatus}
            errorMessage={eventsError}
            onRetry={loadEvents}
            onCreateEvent={openCreateForm}
            onEditEvent={openEditEventForm}
            onDeleteEvent={requestDeleteEvent}
            onOpenSubtask={setDetailSubtask}
            refreshToken={subtasksVersion}
            onEventCoverUpdated={handleEventCoverUpdated}
            onCreateSubtask={openSubtaskForm}
            initialExpandedEventId={selectedEventId}
          />
        )}
      </div>

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

      {isWizardOpen && (
        <EventWizard
          key={wizardKey}
          maxDailyHours={user?.max_daily_hours}
          onClose={closeWizard}
          onEventCreated={handleWizardEventCreated}
          onSubtaskCreated={handleWizardSubtaskCreated}
        />
      )}

      {isSubtaskFormOpen && subtaskFormEvent && (
        <SubtaskFormModal
          key={subtaskFormKey}
          eventId={subtaskFormEvent.eid}
          eventName={subtaskFormEvent.name}
          eventDueDate={subtaskFormEvent.due_date}
          maxDailyHours={user?.max_daily_hours}
          initialValues={editingSubtask ?? undefined}
          onClose={() => {
            setIsSubtaskFormOpen(false);
            setEditingSubtask(null);
          }}
          onCreated={handleSubtaskCreated}
          onUpdated={handleSubtaskUpdated}
        />
      )}

      {reprogrammingSubtask && reprogramEvent && (
        <ReprogramModal
          subtask={reprogrammingSubtask}
          eventName={reprogramEvent.name}
          eventDueDate={reprogramEvent.due_date}
          maxDailyHours={user?.max_daily_hours}
          onClose={() => setReprogrammingSubtask(null)}
          onReprogrammed={handleSubtaskReprogrammed}
        />
      )}

      {isSubtaskWizardOpen && subtaskWizardEvent && (
        <SubtaskWizard
          key={subtaskWizardKey}
          eventId={subtaskWizardEvent.eid}
          eventName={subtaskWizardEvent.name}
          eventDueDate={subtaskWizardEvent.due_date}
          maxDailyHours={user?.max_daily_hours}
          onClose={closeSubtaskWizard}
          onCreated={handleSubtaskWizardCreated}
        />
      )}

      {detailSubtask && (
        <SubtaskDetailModal
          subtask={detailSubtask}
          onClose={() => setDetailSubtask(null)}
          onEdit={openEditSubtaskForm}
          onDelete={requestDeleteSubtask}
          onReprogram={openReprogramSubtask}
          onToggleComplete={handleToggleComplete}
          togglePending={pendingToggleIds.has(detailSubtask.subtask_id)}
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
            ? eventDeleteDescription(deleteEventTarget)
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
  orderHint,
  children,
}: {
  title: string;
  count: string;
  countClass: string;
  showClock?: boolean;
  /** Destino de foco estable (ej. tras borrar una gestión); necesita tabIndex=-1 porque un h2 no es focuseable por defecto. */
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  /** Criterio de aceptación del sprint: describir la regla de orden real de
   * cada grupo (fecha primero, desempate por duración) — ver
   * sortSubtasksByDateThenHours/sortCompletedSubtasksByDateDesc. Se revisó
   * con el equipo como texto siempre visible y se prefirió un trigger con
   * tooltip (mismo patrón nativo `title` que ya usa WizardStageIndicator
   * para los errores de validación) para no sumarle ruido permanente a la
   * columna. */
  orderHint?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className={`task-column${title === "Para Hoy" ? " task-column--today" : ""}`}>
      <div className="column-heading">
        <div className="column-title">
          <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
            {title}
          </h2>
          {showClock && <ClockIcon urgent={title === "Vencidas"} />}
        </div>
        <span className={`task-count ${countClass}`}>{count}</span>
      </div>
      {orderHint && (
        <p className="column-order-hint">
          <button type="button" className="column-order-hint-trigger" title={orderHint}>
            ¿Cómo se ordena?
          </button>
        </p>
      )}
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
  pendingToggleIds,
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
  pendingToggleIds: Set<number>;
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
              pending={pendingToggleIds.has(subtask.subtask_id)}
              completed={completed}
              eventName={subtask.event_name}
            />
          ))
        )}
      </div>
    </div>
  );
}
