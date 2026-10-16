export type SoundKind = "complete" | "uncomplete" | "postpone" | "reactivate" | "reprogram" | "drop";

// [frecuencia inicial, frecuencia final, inicio (s), duración (s)]
type Note = [number, number, number, number];

const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880, A4 = 440, C6 = 1046.5, G6 = 1568;

const SOUNDS: Record<SoundKind, Note[]> = {
  complete: [[C6, C6, 0, 0.35], [G6, G6, 0.09, 0.4]],
  uncomplete: [[A4, A4, 0, 0.35]],
  postpone: [[E5, E5, 0, 0.3], [C5, C5, 0.12, 0.35]],
  reactivate: [[C5, C5, 0, 0.3], [E5, E5, 0.12, 0.35]],
  reprogram: [[G5, C6, 0, 0.18]],
  drop: [[A5, A5, 0, 0.06]],
};

const MASTER_VOLUME = 0.05;
let ctx: AudioContext | undefined;

function voice(c: AudioContext, out: AudioNode, [from, to, start, dur]: Note, octave: number, level: number) {
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.setValueAtTime(from * octave, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to * octave, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(level, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Nunca lanza: sin audio disponible simplemente no suena.
export function playSound(kind: SoundKind) {
  try {
    if (!window.AudioContext) return;
    ctx ??= new window.AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3000;
    const master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    filter.connect(master).connect(ctx.destination);
    for (const note of SOUNDS[kind]) {
      voice(ctx, filter, note, 1, 1);
      voice(ctx, filter, note, 2, 0.15);
    }
  } catch {
    // sin audio disponible: se ignora
  }
}
