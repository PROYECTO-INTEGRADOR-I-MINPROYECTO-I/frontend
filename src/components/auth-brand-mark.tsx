// Login/Register no mostraban ningún rastro de la marca (el profesor señaló
// en revisiones que debería verse "en todo momento"). A diferencia del
// header de la app ya logueada (ver .brand-lockup en homepage.css, que no se
// toca acá — vive en una pestaña con pestañas Eventos/Hoy que no aplican
// antes de iniciar sesión), esta es una versión más grande, centrada encima
// de la tarjeta del formulario, pensada solo para las dos pantallas de auth.

import calendarIcon from "../assets/calendar-icon.svg";

export function AuthBrandMark() {
  return (
    <div className="mb-6 flex items-center justify-center gap-3 px-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#8b1a1a] sm:h-14 sm:w-14">
        <img src={calendarIcon} alt="" className="h-5 w-5 sm:h-7 sm:w-7" />
      </div>
      <span className="font-jost text-[32px] leading-none tracking-[-0.4px] text-[#101828] sm:text-[44px]">
        PlanificApp
      </span>
    </div>
  );
}
