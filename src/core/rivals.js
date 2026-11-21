// Partidos rivales (bots): presencia por zona, campañas propias, golpes contra el jugador,
// avisos de choque y estimaciones para la interfaz. Sin DOM.
import { rng } from './city.js';
import { captacionRival } from './plantel.js';
import * as personaje from './personaje.js';
import { noAgresion, apoyoEn } from './pactos.js';

export const rivales = g => (g.cfg.partidos?.partidos ?? []).filter(p => p.id !== 'otros' && p.id !== g.partidoBase);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const between = (a, b, rnd = Math.random) => a + Math.floor(rnd() * (b - a + 1));
const pick = (items, weight, rnd = Math.random) => {
  const total = items.reduce((s, x) => s + weight(x), 0);
  if (total <= 0) return null;
  let r = rnd() * total;
  for (const x of items) { r -= weight(x); if (r <= 0) return x; }
  return items.at(-1);
};

// ---------- Estado inicial de los bots ----------
export function nuevosBots(g) {
  const B = g.cfg.rivales.base;
  return Object.fromEntries(rivales(g).map(r => [r.id, { accion: null, libreDesde: B.arranque + between(0, 4, rng(`${g.prov.id}:${r.id}:bot`)) }]));
}

// ---------- Presencia ----------
// Peso base de cada rival: su resultado en la última elección de la provincia (o parejo si no hay datos)
function baseShares(g) {
  const rs = rivales(g), pf = g.perfilElectoral[0];
  const raw = Object.fromEntries(rs.map(r => [r.id, Math.max(0.02, pf?.partidos?.[r.id] ?? 1 / rs.length)]));
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / sum]));
}

const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

// Presencia inicial (determinista) de cada rival en la zona; suma 1
function presenciaBase(g, zonaId) {
  g._pres ??= {};
  if (g._pres[zonaId]) return g._pres[zonaId];
  const base = baseShares(g), out = {};
  let sum = 0;
  for (const r of rivales(g)) {
    out[r.id] = base[r.id] * Math.exp(0.35 * gauss(rng(`${g.prov.id}:${zonaId}:${r.id}`)));
    sum += out[r.id];
  }
  for (const k of Object.keys(out)) out[k] /= sum;
  return (g._pres[zonaId] = out);
}

// Presencia vigente: la dinámica (si las campañas la movieron) o la base
export const presencia = (g, zonaId) => g.zonas[zonaId].rivalPres ?? presenciaBase(g, zonaId);

function sumarPresencia(g, zonaId, rivalId, delta) {
  const p = { ...presencia(g, zonaId) };
  p[rivalId] = Math.max(0.01, p[rivalId] + delta);
  const sum = Object.values(p).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(p)) p[k] = +(p[k] / sum).toFixed(5);
  g.zonas[zonaId].rivalPres = p;
}

// ---------- Visibilidad ----------
// ¿Sabés con certeza lo que pasa en la zona? Con presencia propia o confianza vecinal, sí; si no, es solo un rumor.
export function certeza(g, zona) {
  const C = g.cfg.rivales.base.certeza;
  return zona.control >= C.control || zona.trust >= C.confianza ? 'confirmado' : 'rumor';
}

export const efectosActivos = (g, zonaId) => g.zonas[zonaId].efectos.filter(e => e.hasta > g.day);

// Definición de una acción de un bot (propia u hostil)
export function defAccion(g, a) {
  return (a.tipo === 'propia' ? g.cfg.rivales.propias : g.cfg.rivales.acciones).find(x => x.id === a.accion);
}

// Acciones actuales de todos los bots (para el panel, el mapa y los choques)
export function agenda(g) {
  return Object.entries(g.bots).filter(([, b]) => b.accion).map(([rival, b]) => ({ rival, ...b.accion, def: defAccion(g, b.accion) }));
}

// ---------- Choques con la planificación del jugador ----------
// Acciones rivales en la zona que se cruzan con la ventana [desde, hasta] de una misión (vigentes, planeadas o ya hechas).
// Cada choque indica su riesgo para esa misión: puntos de éxito y/o bloqueo.
export function choques(g, m, zonaId, desde, hasta) {
  const B = g.cfg.rivales.base, zona = g.zonas[zonaId], cert = certeza(g, zona), out = [];
  const consider = a => {
    if (a.zona !== zonaId || a.inicio > hasta || a.fin < desde) return;
    const def = defAccion(g, a); if (!def) return;
    let chance = 0, bloqueo = false;
    if (a.tipo === 'hostil') {
      chance += def.chance?.[m.id] ?? 0;
      if (def.bloquea?.includes(m.id)) { bloqueo = true; chance -= B.penalBloqueo; }
    } else if (def.compite?.includes(m.id)) chance -= B.penalCompetencia;
    if (!chance) return;
    out.push({ rival: a.rival, accion: def, tipo: a.tipo, inicio: a.inicio, fin: a.fin, enDias: Math.max(0, a.inicio - g.day), enCurso: g.day >= a.inicio, certeza: cert, chance, bloqueo });
  };
  for (const a of agenda(g)) consider(a);
  for (const h of g.historialRivales) consider(h);
  return out;
}

// ---------- Estimación para la interfaz ----------
const EST_PROB_DIARIA = 0.0015;
function accionesPosibles(g, zona, rival) {
  const activas = new Set(zona.efectos.filter(e => e.rival === rival.id).map(e => e.accion));
  return g.cfg.rivales.acciones.filter(a => !activas.has(a.id) && (a.peso[rival.id] ?? 0) > 0);
}

// Qué podrían hacer los rivales en la zona y con qué probabilidad (30 días): estimación, no certeza
export function amenaza(g, zona) {
  const B = g.cfg.rivales.base, pres = presencia(g, zona.id);
  const detalle = rivales(g).map(r => {
    const activa = g.jobs.some(j => j.zone === zona.id) ? 1.5 : 1;
    const p = zona.control < B.controlMin || pres[r.id] < B.presenciaMin ? 0 : EST_PROB_DIARIA * (1 + 6 * zona.control) * (pres[r.id] / 0.25) * activa;
    const acc = accionesPosibles(g, zona, r).sort((a, b) => b.peso[r.id] - a.peso[r.id])[0];
    return { partido: r, presencia: pres[r.id], prob30: 1 - Math.pow(1 - p, 30), accion: acc ?? null };
  }).sort((a, b) => b.presencia - a.presencia);
  const total = 1 - detalle.reduce((s, d) => s * (1 - d.prob30), 1);
  const nivel = zona.control < B.controlMin ? 'ninguna' : total < 0.15 ? 'baja' : total < 0.45 ? 'media' : 'alta';
  return { detalle, total, nivel };
}

// Presencia media de un rival en toda la ciudad, ponderada por población
export function presenciaCiudad(g, rivalId) {
  let num = 0, den = 0;
  for (const z of Object.values(g.zonas)) { num += presencia(g, z.id)[rivalId] * z.pop; den += z.pop; }
  return den ? num / den : 0;
}

// ---------- Turno diario de los bots ----------
// rnd inyectable para pruebas
export function tick(g, rnd = Math.random) {
  const R = g.cfg.rivales; if (!R) return;
  for (const z of Object.values(g.zonas)) z.efectos = z.efectos.filter(e => e.hasta > g.day);
  for (const r of rivales(g)) {
    const bot = g.bots[r.id]; if (!bot) continue;
    const a = bot.accion;
    if (a) {
      if (a.fase === 'planeada' && g.day >= a.inicio) iniciarHostil(g, r, a);
      if (g.day >= a.fin && (a.fase === 'en_curso' || a.tipo === 'propia')) terminar(g, r, bot, rnd);
    } else if (g.day >= bot.libreDesde && g.day >= R.base.arranque) elegir(g, r, bot, rnd);
  }
}

// El rival queda libre y decide su próxima acción: campaña propia o golpe contra el jugador
function elegir(g, r, bot, rnd) {
  const R = g.cfg.rivales, B = R.base, zonas = Object.values(g.zonas).filter(z => !apoyoEn(g, r.id, z.id));   // en un barrio pactado no compite
  const conControl = zonas.filter(z => z.control >= B.controlMin && presencia(g, z.id)[r.id] >= B.presenciaMin);
  const pop = zonas.reduce((s, z) => s + z.pop, 0) || 1;
  const amenazaGlobal = zonas.reduce((s, z) => s + z.pop * z.control, 0) / pop;
  const pHostil = conControl.length && !noAgresion(g, r.id) ? clamp(B.hostilBase + B.hostilPorAmenaza * amenazaGlobal, 0, B.hostilMax) : 0;
  if (rnd() < pHostil) {
    const z = pick(conControl, z => Math.pow(z.pop, 0.7) * (0.3 + presencia(g, z.id)[r.id]) * (1 + 4 * z.control), rnd);
    const def = z && pick(accionesPosibles(g, z, r), a => a.peso[r.id], rnd);
    if (z && def) {
      const prep = between(def.preparacion[0], def.preparacion[1], rnd);
      bot.accion = { tipo: 'hostil', accion: def.id, zona: z.id, fase: 'planeada', planDesde: g.day, inicio: g.day + prep, fin: g.day + prep + def.dias };
      const cert = certeza(g, z);
      g.note(`${cert === 'confirmado' ? 'Confirmado' : 'Rumor'}: ${r.nombre} prepara «${def.nombre.toLowerCase()}» en ${z.nombre} (en ${prep} d).`, 'rival');
      return;
    }
  }
  const def = pick(R.propias, a => a.peso[r.id] ?? 0, rnd);
  const z = pick(zonas, z => Math.pow(z.pop, 0.7) * (0.5 + (1 - presencia(g, z.id)[r.id])) * (1 + 1.5 * z.control), rnd);
  if (def && z) bot.accion = { tipo: 'propia', accion: def.id, zona: z.id, fase: 'en_curso', planDesde: g.day, inicio: g.day, fin: g.day + def.dias };
}

// Un golpe pasa de planeado a ejecución: efecto inmediato y/o efecto vigente en la zona
function iniciarHostil(g, r, a) {
  const def = defAccion(g, a), z = g.zonas[a.zona];
  a.fase = 'en_curso';
  if (def.trustAhora) z.trust = clamp(z.trust + def.trustAhora, 0, 100);
  if (def.dias > 0) z.efectos.push({ rival: r.id, accion: def.id, hasta: a.fin });
  if (def.captacion) { captacionRival(g, r.id); return; }   // el resultado (éxito o rechazo) lo cuenta el plantel
  g.note(`${r.nombre} ${def.texto} en ${z.nombre}.`, 'rival');
}

// La acción termina: se archiva y el bot descansa unos días
function terminar(g, r, bot, rnd) {
  const a = bot.accion, def = defAccion(g, a), z = g.zonas[a.zona], B = g.cfg.rivales.base;
  if (a.tipo === 'propia') {
    sumarPresencia(g, a.zona, r.id, def.presencia);
    const erosion = Math.min(z.control, def.erosion * presencia(g, a.zona)[r.id] / 0.25 * personaje.erosionMult(g) * (g.org?.comites?.[a.zona] ? g.cfg.organizacion.comite.erosion : 1));
    if (z.control > 0 && erosion > 0) {
      z.control = clamp(z.control - erosion, 0, 1);
      g.note(`${r.nombre} ${def.texto} en ${z.nombre} y te quita terreno (−${(erosion * 100).toFixed(1)}% de control).`, 'rival');
    }
  }
  g.historialRivales.unshift({ rival: r.id, accion: a.accion, tipo: a.tipo, zona: a.zona, inicio: a.inicio, fin: Math.min(a.fin, g.day) });
  g.historialRivales.length = Math.min(g.historialRivales.length, B.historial);
  bot.accion = null;
  bot.libreDesde = g.day + between(B.pausa[0], B.pausa[1], rnd);
}

// ---------- Restauración segura desde un guardado (los campos son opcionales: partidas viejas no los traen) ----------
const fin = Number.isFinite;
function accionValida(g, a) {
  if (!a || !['propia', 'hostil'].includes(a.tipo) || !g.zonas[a.zona]) return false;
  if (![a.planDesde, a.inicio, a.fin].every(fin)) return false;
  return !!defAccion(g, a);
}
const limpiaAccion = a => ({ tipo: a.tipo, accion: a.accion, zona: a.zona, fase: a.fase === 'planeada' ? 'planeada' : 'en_curso', planDesde: a.planDesde, inicio: a.inicio, fin: a.fin });

export function sanearBots(g, raw) {
  const out = nuevosBots(g);
  for (const r of rivales(g)) {
    const b = raw?.[r.id]; if (!b) continue;
    if (fin(b.libreDesde)) out[r.id].libreDesde = b.libreDesde;
    if (accionValida(g, b.accion)) out[r.id].accion = limpiaAccion(b.accion);
  }
  return out;
}

export function sanearHistorial(g, raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(h => h && rivales(g).some(r => r.id === h.rival) && accionValida(g, { ...h, planDesde: h.inicio }))
    .slice(0, g.cfg.rivales.base.historial).map(h => ({ rival: h.rival, accion: h.accion, tipo: h.tipo, zona: h.zona, inicio: h.inicio, fin: h.fin }));
}

// Presencia dinámica de una zona: solo si trae todos los rivales con números válidos; se renormaliza a 1
export function sanearPres(g, raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const ids = rivales(g).map(r => r.id);
  if (!ids.every(id => fin(raw[id]) && raw[id] >= 0)) return undefined;
  const sum = ids.reduce((s, id) => s + raw[id], 0);
  return sum > 0 ? Object.fromEntries(ids.map(id => [id, +(raw[id] / sum).toFixed(5)])) : undefined;
}
