import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Sun } from "lucide-react";
import calendarIcon from "../assets/calendar-icon.svg";
import helpRing from "../assets/help-ring.svg";
import { EventMenu } from "../components/event-menu";
import { EventFormModal } from "../components/event-form-modal";
import type { Event } from "../lib/types";
import "./homepage.css";

const filters = ["Todos", "Reuniones", "Entregas", "Llamadas", "Personal"];

// Solo un entero positivo es un eid válido; cualquier otro valor de
// ?evento= (vacío, texto, decimales) se trata como "sin selección".
const EVENT_ID_PATTERN = /^\d+$/;

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
    
    const navigate = useNavigate();
    const goToLogin = () => {
    navigate("/login")
    };

  const [activeFilter, setActiveFilter] = useState("Todos");
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Sube en cada apertura para forzar un montaje limpio de EventFormModal
  // (defaultValues frescos y fetch de tipos sin depender de un reset() en
  // efecto).
  const [formKey, setFormKey] = useState(0);
  const [newEvent, setNewEvent] = useState<Event | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  const eventoParam = searchParams.get("evento");
  const selectedEventId = eventoParam && EVENT_ID_PATTERN.test(eventoParam) ? Number(eventoParam) : null;

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    };
  }, []);

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

  function handleEventCreated(event: Event) {
    setIsFormOpen(false);
    setNewEvent(event);
    handleSelectEvent(event);
    setSuccessMessage("Evento creado exitosamente");
    if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = window.setTimeout(() => setSuccessMessage(null), 4000);
  }

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
          <EventMenu
            selectedEventId={selectedEventId}
            onSelect={handleSelectEvent}
            onCreateNew={openCreateForm}
            newEvent={newEvent}
            onNewEventConsumed={() => setNewEvent(null)}
          />
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

      <section className="task-columns" aria-label="Tareas del día">
        <TaskColumn title="Próximas" countClass="count--blue" count="0" showClock />
        <TaskColumn title="Para Hoy" countClass="count--red" count="0">
          <div className="empty-state">
            <p>Aún no tienes tareas<br />¡Crea una nueva!</p>
            <button className="create-task-button" type="button" onClick={goToLogin}>
              Crear Tarea <Plus aria-hidden="true" size={22} />
            </button>
          </div>
        </TaskColumn>
        <TaskColumn title="Vencidas" countClass="count--red" count="0" showClock />
      </section>

      <button className="help-button" type="button" aria-label="Ayuda">
        <img src={helpRing} alt="" />
      </button>

      {isFormOpen && (
        <EventFormModal key={formKey} onClose={() => setIsFormOpen(false)} onCreated={handleEventCreated} />
      )}
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