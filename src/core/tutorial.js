// Objetivos guiados cortos (para casuales). El paso actual es el primero cuyo objetivo todavía no se cumplió. Sin DOM.
import { cumpleConds, progresoConds } from './revelado.js';
export const pasos = g => g.cfg.tutorial?.pasos ?? [];
export function actual(g) {
  const p = pasos(g).find(x => !cumpleConds(g, x.cond)); if (!p) return null;
  const pr = progresoConds(g, p.cond).find(x => !x.ok);
  return { ...p, hecho: pasos(g).indexOf(p), total: pasos(g).length, progreso: pr ? { actual: pr.actual, meta: pr.meta } : null };
}
