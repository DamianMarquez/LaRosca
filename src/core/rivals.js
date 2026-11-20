// Partidos rivales: presencia por zona, estimación de amenazas y acciones contra el jugador. Sin DOM.
import { rng } from './city.js';

export const rivales = g => (g.cfg.partidos?.partidos ?? []).filter(p => p.id !== 'otros');

// Peso base de cada rival: su resultado en la última elección de la provincia (o parejo si no hay datos)
function baseShares(g) {
  const rs = rivales(g), pf = g.perfilElectoral[0];
  const raw = Object.fromEntries(rs.map(r => [r.id, Math.max(0.02, pf?.partidos?.[r.id] ?? 1 / rs.length)]));
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / sum]));
}

const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

// Presencia de cada rival en la zona (suma 1): su fuerza provincial con variación local reproducible
export function presencia(g, zonaId) {
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

// Probabilidad diaria de que un rival reaccione en la zona
function pDiaria(g, zona, rival) {
  const B = g.cfg.rivales.base, pres = presencia(g, zona.id)[rival.id];
  if (zona.control < B.controlMin || pres < B.presenciaMin) return 0;
  const activa = g.jobs.some(j => j.zone === zona.id) ? 1.5 : 1;           // actuar en la zona llama la atención
  return B.probDiaria * (1 + 6 * zona.control) * (pres / 0.25) * activa;
}

function accionesPosibles(g, zona, rival) {
  const activas = new Set(zona.efectos.filter(e => e.rival === rival.id).map(e => e.accion));
  return g.cfg.rivales.acciones.filter(a => !activas.has(a.id) && (a.peso[rival.id] ?? 0) > 0);
}

// Estimación para mostrar en la interfaz: qué podrían hacer los rivales en la zona y con qué probabilidad (30 días)
export function amenaza(g, zona) {
  const B = g.cfg.rivales.base, pres = presencia(g, zona.id);
  const detalle = rivales(g).map(r => {
    const p = pDiaria(g, zona, r), acc = accionesPosibles(g, zona, r).sort((a, b) => b.peso[r.id] - a.peso[r.id])[0];
    return { partido: r, presencia: pres[r.id], prob30: 1 - Math.pow(1 - p, 30), accion: acc ?? null };
  }).sort((a, b) => b.presencia - a.presencia);
  const total = 1 - detalle.reduce((s, d) => s * (1 - d.prob30), 1);
  const nivel = zona.control < B.controlMin ? 'ninguna' : total < 0.15 ? 'baja' : total < 0.45 ? 'media' : 'alta';
  return { detalle, total, nivel };
}

// Acciones vigentes en la zona (ya sin vencidas)
export const efectosActivos = (g, zonaId) => g.zonas[zonaId].efectos.filter(e => e.hasta > g.day);

// Reacciones rivales de hoy. rnd inyectable para pruebas.
export function tick(g, rnd = Math.random) {
  const R = g.cfg.rivales; if (!R) return;
  for (const z of Object.values(g.zonas)) z.efectos = z.efectos.filter(e => e.hasta > g.day);
  let n = 0;
  for (const z of Object.values(g.zonas)) {
    if (n >= R.base.maxPorDia) break;
    if (z.control < R.base.controlMin) continue;
    for (const r of rivales(g)) {
      if (n >= R.base.maxPorDia || rnd() >= pDiaria(g, z, r)) continue;
      const opts = accionesPosibles(g, z, r);
      let x = rnd() * opts.reduce((s, a) => s + a.peso[r.id], 0), acc = opts[0];
      for (const a of opts) { x -= a.peso[r.id]; if (x <= 0) { acc = a; break; } }
      if (!acc) continue;
      if (acc.trustAhora) z.trust = Math.max(0, Math.min(100, z.trust + acc.trustAhora));
      if (acc.dias > 0) z.efectos.push({ rival: r.id, accion: acc.id, hasta: g.day + acc.dias });
      g.note(`${r.nombre} ${acc.texto} en ${z.nombre}.`, 'bad');
      n++;
    }
  }
}
