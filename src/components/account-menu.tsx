// PIM1-121: reemplaza el avatar estático ("AL" fijo) por las iniciales del
// usuario real, con un menú desplegable para cerrar sesión. Mismo patrón de
// popover cerrable con click afuera / Escape que EventMenu, pero sin roving
// tabindex: un solo ítem no lo necesita.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

export function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/login");
  }

  const initials = user ? initialsFor(user.name) : "?";
  const label = user ? `Cuenta de ${user.name}` : "Cuenta";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((prev) => !prev)}
        className="avatar cursor-pointer border-0"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Cuenta"
          className="absolute top-[calc(100%+8px)] right-0 z-40 w-[180px] rounded-[6px] border border-[#e1e5ea] bg-white py-1 shadow-sm"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-jost text-[12px] text-[#8b1a1a] hover:bg-[#fff0f0] focus-visible:bg-[#fff0f0] focus-visible:outline-none"
          >
            <LogOut size={13} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
