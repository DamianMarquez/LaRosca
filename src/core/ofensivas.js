// Ofensivas del jugador contra otros partidos: sabotaje, desprestigio, captación y medios. Sin DOM.
// Son misiones (categoria 'ofensiva') que se resuelven con el mismo turno; acá viven el rencor y los efectos.
import { presencia, sumarPresencia } from './rivals.js';
import { noAgresion, cambiarRelacion, relacion, quitarPactosCon } from './pactos.js';
import { robarCuadro } from './plantel.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const O = g => g.cfg.ofensivas ?? { acciones: [], rencor: { max: 100, decaeDia: 0, hostilPorPunto: 0, rompePacto: 999, fallaMitad: 0.5, umbrales: { medio: 30, alto: 60 } }, presenciaMin: 0.04, presenciaDificultad: 35 };
export const acciones = g => O(g).acciones;
export const defOf = (g, id) => O(g).acciones.find(a => a.id === id) ?? null;
export const iniciar = g => ({});

// ---------- Rencor ----------
export const rencor = (g, rid) => g.rencores?.[rid] ?? 0;
export function subirRencor(g, rid, n) { g.rencores[rid] = clamp(rencor(g, rid) + n, 0, O(g).rencor.max); }
export function nivelRencor(g, rid) { const r = rencor(g, rid), U = O(g).rencor.umbrales; return r >= U.alto ? 'alto' : r >= U.medio ? 'medio' : r > 0.5 ? 'bajo' : 'ninguno'; }
// Probabilidad extra de que el rival golpee, según su rencor (la usan los bots)
export const hostilExtra = (g, rid) => rencor(g, rid) * O(g).rencor.hostilPorPunto;

// ---------- Disponibilidad y chance ----------
export function motivo(g, a, rid, zonaId) {
  const z = g.zonas[zonaId]; if (!z) return 'Elegí un barrio.';
  if (!g.rival(rid)) return 'Ese partido no existe.';
  if (noAgresion(g, rid)) return 'Tenés un pacto de no agresión con ese partido.';
  if (presencia(g, zonaId)[rid] < O(g).presenciaMin) return 'Ese partido casi no tiene presencia acá.';
  const R = a.requiere ?? {};
  if (R.fama && g.fama < R.fama && g.modo === 'fundador') return `Necesitás notoriedad ${R.fama}.`;
  if (R.fases && !R.fases.includes(g.elecciones?.proceso?.fase)) return 'Solo en campaña electoral.';
  if (a.captacion && !(g.rivalesPlantel?.[rid] ?? []).some(m => m.rol !== 'Líder')) return 'No quedan cuadros para seducir.';
  return g.canStart(a, zonaId);
}
export function chance(g, a, zonaId, rid) {
  const z = g.zonas[zonaId], base = g.chance(a, z), pres = presencia(g, zonaId)[rid] ?? 0;
  const factors = [...base.factors, [`Presencia de ${g.rival(rid)?.nombre ?? 'el rival'} en el barrio`, -Math.round(pres * O(g).presenciaDificultad)]];
  if (a.grupo === 'medios') { const f = Math.round(g.fama / 10); if (f) factors.push(['Tu notoriedad', f]); }
  return { c: clamp(Math.round(factors.reduce((s, f) => s + f[1], 0)), 5, 95), factors };
}
export const exposicionPrevista = a => a.efecto?.exposicion ?? 0;

// ---------- Lanzar y resolver ----------
export function lanzar(g, rid, zonaId, accionId) {
  const a = defOf(g, accionId); if (!a) return 'Esa acción no existe.';
  const m = motivo(g, a, rid, zonaId); if (m) return m;
  return g.start(a.id, zonaId, 'blanco', 'personal', { rival: rid }) ? null : 'No se pudo lanzar.';
}

export function resolver(g, j, a, z, ok) {
  const rid = j.rival, r = g.rival(rid), E = a.efecto ?? {}, R = O(g).rencor;
  if (!r) { g.note(`«${a.nombre}» se diluyó: el rival ya no está.`, 'info'); return; }
  const pct = v => (Math.abs(v) * 100).toFixed(1).replace('.', ',');
  if (ok) {
    if (E.presencia) sumarPresencia(g, z.id, rid, E.presencia);
    if (E.relacion) cambiarRelacion(g, rid, E.relacion);
    if (E.exposicion) g.exposure = clamp(g.exposure + E.exposicion, 0, 100);
    if (E.fama) g.ganarFama(E.fama);
    if (E.trustZona) z.trust = clamp(z.trust + E.trustZona, 0, 100);
    if (E.campana && g.elecciones?.proceso) g.elecciones.proceso.campana[z.id] = clamp((g.elecciones.proceso.campana[z.id] ?? 0) + E.campana, 0, g.cfg.elecciones.modelo.campanaMax);
    subirRencor(g, rid, E.rencor ?? 0);
    g.ganarXp(a.gana.xp);
    if (a.captacion) {
      const x = robarCuadro(g, rid);
      g.note(x ? `${x.nombre} dejó ${r.nombre} y se sumó a tu partido.` : `Nadie del equipo de ${r.nombre} se animó a cambiar de bando.`, x ? 'ok' : 'info');
    } else g.note(`«${a.nombre}» contra ${r.nombre} salió bien en ${z.nombre}${E.presencia ? `: su presencia bajó ${pct(E.presencia)} puntos` : ''}.`, 'ok');
  } else {
    z.trust = clamp(z.trust + a.falla.trust, 0, 100);
    subirRencor(g, rid, (E.rencor ?? 0) * R.fallaMitad);
    cambiarRelacion(g, rid, Math.round((E.relacion ?? 0) / 2));
    const rb = a.rebote;
    if (rb && Math.random() < rb.p) {
      for (const zz of Object.values(g.zonas)) zz.trust = clamp(zz.trust + (rb.trust ?? 0), 0, 100);
      g.exposure = clamp(g.exposure + (rb.expo ?? 0), 0, 100);
      g.note(`«${a.nombre}» contra ${r.nombre} se te dio vuelta: se supo que fuiste vos y perdiste confianza${rb.expo ? ' y creció la sospecha' : ''}.`, 'bad');
    } else g.note(`«${a.nombre}» contra ${r.nombre} falló en ${z.nombre}: ${r.nombre} se enteró.`, 'bad');
  }
}

// ---------- Turno diario ----------
export function tick(g) {
  const R = O(g).rencor;
  for (const id of Object.keys(g.rencores)) {
    g.rencores[id] = Math.max(0, g.rencores[id] - R.decaeDia);
    if (g.rencores[id] >= R.rompePacto && quitarPactosCon(g, id, 'te considera un enemigo')) g.rencores[id] = R.rompePacto - 5;
    if (g.rencores[id] <= 0) delete g.rencores[id];
  }
}

// ---------- Restauración segura ----------
export function sanear(g, raw) {
  const out = {}; if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw)) if (g.rival(id) && Number.isFinite(v) && v > 0) out[id] = clamp(v, 0, O(g).rencor.max);
  return out;
}
