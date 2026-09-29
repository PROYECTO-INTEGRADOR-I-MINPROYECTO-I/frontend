// Card especial "Crear nuevo evento" dentro del roulette de EventsView
// (HU-13/PIM1-111): mismo ancho/silueta que EventCard para que se vea como
// una tarjeta más del scroll, con un "+" grande y el label debajo.

import { Plus } from "lucide-react";

interface CreateEventCardProps {
  onClick: () => void;
}

export function CreateEventCard({ onClick }: CreateEventCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-60 shrink-0 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-[#d4d5d7] bg-white p-4 text-[#8b1a1a] transition-colors hover:border-[#8b1a1a] hover:bg-[#fff0f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b1a1a]"
      style={{ minHeight: 260 }}
    >
      <Plus aria-hidden="true" size={40} />
      <span className="font-jost text-[14px]">Crear nuevo evento</span>
    </button>
  );
}
