// Diálogo de confirmación reutilizable para borrados (PIM1-31). No usa Modal
// porque semánticamente es un alertdialog (role="alertdialog"), no un diálogo
// de contenido general: mismo patrón de foco atrapado / Esc / devolver el
// foco que modal.tsx, pero sin cabecera roja ni chips.

import { useEffect, useRef } from "react";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Mientras se procesa el borrado: deshabilita los botones y cambia el texto del de confirmar. */
  busy?: boolean;
  /** Error de la última confirmación fallida; se muestra en el diálogo para poder reintentar sin cerrarlo. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Mismo motivo que onCloseRef en modal.tsx: onCancel casi nunca llega
  // memoizado, y este efecto solo debe correr al abrir/cerrar el diálogo.
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement;

    // Foco inicial en "Cancelar" (primer botón del DOM) para que un Enter
    // accidental no dispare el borrado. Diferido al siguiente frame por la
    // misma razón que en modal.tsx (evitar el cleanup fantasma de StrictMode).
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
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
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-[384px] rounded-[10px] bg-white p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]"
      >
        <h2 id="confirm-dialog-title" className="font-jost text-[18px] leading-[23px] text-[#1e2939]">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mt-2 font-source text-[14px] leading-[22.75px] text-[#4a5565]">
          {description}
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-[#fff0f0] p-3 text-[13px] text-[#8b1a1a]">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-lg border-[0.635px] border-[#8b1a1a] bg-white py-[10px] font-jost text-[14px] text-[#8b1a1a] shadow-none hover:bg-[#fff0f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a] focus-visible:ring-0"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            aria-busy={busy}
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-[#8b1a1a] py-[10px] font-jost text-[14px] text-white shadow-none hover:bg-[#6f1515] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a] focus-visible:ring-0 disabled:opacity-60"
          >
            {busy ? "Eliminando…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
