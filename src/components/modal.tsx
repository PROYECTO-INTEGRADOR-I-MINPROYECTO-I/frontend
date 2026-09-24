// Modal reutilizable (PIM1-23, y luego PIM1-27/PIM1-31): cabecera roja con
// chips y título opcionales, cuerpo libre y pie de acciones. Maneja foco
// atrapado, cierre con Esc y devuelve el foco al elemento que lo abrió.

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

export interface ModalChip {
  label: string;
  className?: string;
  /** Para chips con color dinámico (ej. categoría de texto libre, ver subtask-display.ts). */
  style?: React.CSSProperties;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  chips?: ModalChip[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Elemento a enfocar al abrir; por defecto el primer campo del cuerpo. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, chips, children, footer, className, initialFocusRef }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // onClose casi nunca llega memoizado (los callers suelen pasar una arrow
  // function nueva en cada render). Si el efecto de abajo dependiera de
  // onClose directamente, cada re-render de un padre no memoizado volvería
  // a correr el efecto: la limpieza devolvería el foco al elemento que lo
  // tenía antes de abrir el modal (sacándolo del campo recién enfocado, lo
  // que en un formulario con validación "onBlur" pinta un error fantasma) y
  // luego el efecto lo reenfocaría, dejando el error pintado igual. Por eso
  // se guarda en un ref y el efecto de foco/trampa no depende de onClose.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement;

    // El foco se pone en el siguiente frame (no sincrónico) a propósito:
    // en StrictMode (desarrollo), React monta este efecto, lo limpia y lo
    // vuelve a montar de inmediato para detectar cleanups faltantes. Si
    // enfocáramos el campo de forma sincrónica aquí, esa limpieza fantasma
    // devolvería el foco al trigger antes de que el segundo montaje
    // corriera, disparando un blur real sobre el campo (y con eso, el
    // error de validación "onBlur") aunque el usuario nunca lo haya
    // tocado. Difiriendo el foco, esa limpieza fantasma se cancela antes
    // de llegar a robar el foco.
    const frame = requestAnimationFrame(() => {
      // El foco inicial debe ir al primer campo del cuerpo, no a la X de
      // la cabecera (que aparece antes en el orden del DOM).
      const firstField =
        initialFocusRef?.current ??
        bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstField?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const list = Array.from(focusable);
      const first = list[0];
      const last = list[list.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose se lee via onCloseRef a propósito, ver comentario arriba.
  }, [open, initialFocusRef]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "w-full max-w-[448px] rounded-[10px] bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]",
          className
        )}
      >
        <div className="relative rounded-t-[10px] bg-[#8b1a1a] px-6 pt-8 pb-6">
          {chips && chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span
                  key={chip.label}
                  style={chip.style}
                  className={cn(
                    "rounded-full px-[10px] py-1 font-jost text-[11px] leading-[16.5px]",
                    !chip.style && (chip.className ?? "bg-[#fffbeb] text-[#bb4d00]")
                  )}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          )}
          <h2
            id={titleId}
            className={cn(
              "font-jost text-[20px] leading-[25px] text-white",
              chips && chips.length > 0 && "mt-3"
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="absolute top-5 right-5 text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
          >
            <X size={20} />
          </button>
        </div>

        <div ref={bodyRef} className="px-6 py-6">
          {children}
        </div>

        {footer && <div className="flex gap-3 border-t border-[#f3f4f6] px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
