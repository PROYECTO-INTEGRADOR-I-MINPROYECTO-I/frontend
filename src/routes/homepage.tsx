import { useState } from "react";
import { useNavigate } from "react-router-dom";
import calendarIcon from "../assets/calendar-icon.svg";
import { ChevronDown } from 'lucide-react';
import helpRing from "../assets/help-ring.svg";
import "./homepage.css";

const filters = ["Todos", "Reuniones", "Entregas", "Llamadas", "Personal"];

function ClockIcon({ muted = false }: { muted?: boolean }) {
  return <span aria-hidden="true" className={`clock-icon${muted ? " clock-icon--muted" : ""}`} />;
}

function SunIcon() {
  return <span aria-hidden="true" className="sun-icon">☼</span>;
}

export function HomePage() {
    
    const navigate = useNavigate();
    const goToLogin = () => {
    navigate("/login")
    };

  const [activeFilter, setActiveFilter] = useState("Todos");

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

      <section className="planner-intro" aria-labelledby="today-heading">
        <div className="intro-row">
          <h1 id="today-heading">Hoy <SunIcon /></h1>
          <button className="event-button inline-flex items-center justify-center gap-2" type="button">
            Nuevo Evento <ChevronDown size={20} color="#ffff" />
          </button>
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
              Crear Tarea <span aria-hidden="true">＋</span>
            </button>
          </div>
        </TaskColumn>
        <TaskColumn title="Vencidas" countClass="count--red" count="0" showClock />
      </section>

      <button className="help-button" type="button" aria-label="Ayuda">
        <img src={helpRing} alt="" />
      </button>
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