// Escalafón: requisitos visibles para ascender, puestos disponibles en cada nivel y ascenso del jugador. Sin DOM.
import * as linea from './linea.js';
import * as personaje from './personaje.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const E = g => g.cfg.escalafon;
const fundador = g => g.modo === 'fundador';   // quien funda no escala: su influencia se deriva de su partido (ver organizacion.js)

// Puestos que existen en un nivel (rango): crecen con el tamaño del partido
export const puestos = (g, nivel) => Math.max(1, Math.floor(g.afiliados / (g.umbral(E(g).porPuesto[nivel] ?? Infinity))));
export const ocupados = (g, nivel) => g.plantel.ocupados[nivel] ?? 1;
export const hayVacante = (g, nivel) => puestos(g, nivel) > ocupados(g, nivel);

// Checklist para pedir el ascenso al siguiente rango. null si ya estás en la cima.
export function requisitos(g) {
  if (fundador(g)) return null;
  const destino = g.player.rank + 1;
  if (destino >= g.rangos.length) return null;
  const R = E(g).requisitos[destino];
  const nZonas = R.zonas.n > 0 ? Math.min(R.zonas.n, Math.max(1, Math.round(Object.keys(g.zonas).length * 0.25))) : 0;   // ciudades con pocos barrios piden menos
  const zonas = Object.values(g.zonas).filter(z => z.control >= R.zonas.control).length;
  const metaAfil = g.umbral(R.afiliados);
  const rel = g.linea?.lider?.relacion;
  const items = [
    { id: 'xp', texto: 'Experiencia', ok: g.player.xp >= g.cfg.promotionXp[destino], actual: Math.floor(g.player.xp), meta: g.cfg.promotionXp[destino] },
    { id: 'afiliados', texto: 'Afiliados', ok: g.afiliados >= metaAfil, actual: g.afiliados, meta: metaAfil },
  ];
  if (nZonas > 0) items.push({ id: 'zonas', texto: `Barrios con ≥${Math.round(R.zonas.control * 100)}% de control`, ok: zonas >= nZonas, actual: zonas, meta: nZonas });
  if (R.relacion > 0) items.push({ id: 'relacion', texto: 'Relación con tu líder', ok: rel === undefined || rel >= R.relacion, actual: rel === undefined ? '—' : Math.round(rel), meta: R.relacion });
  for (const x of R.extras ?? []) items.push(extra(g, x));   // exigencias electorales de los rangos altos
  items.push({ id: 'vacante', texto: `Puesto vacante: ${g.rangos[destino]}`, ok: hayVacante(g, destino), actual: `${ocupados(g, destino)}/${puestos(g, destino)} ocupados`, meta: null,
    ayuda: hayVacante(g, destino) ? null : `Se abre un puesto más cada ${g.umbral(E(g).porPuesto[destino])} afiliados, o si su titular se va.` });
  return { destino, rango: g.rangos[destino], items, todos: items.every(i => i.ok) };
}

// Condiciones extra de los rangos altos del afiliado: dependen del motor electoral.
function extra(g, x) {
  if (x.tipo === 'referentes') { const n = g.plantel.miembros.filter(m => m.cargo?.startsWith('ref:')).length; return { id: 'referentes', texto: `Referentes de barrio (${x.n})`, ok: n >= x.n, actual: n, meta: x.n }; }
  if (x.tipo === 'pacto') { const n = g.alianzas?.pactos?.length ?? 0; return { id: 'pacto', texto: 'Al menos un pacto vigente', ok: n >= 1, actual: n, meta: 1 }; }
  if (x.tipo === 'bancas') { const n = g.elecciones ? (g.elecciones.bancas ?? 0) : null; return { id: 'bancas', texto: `Bancas obtenidas (${x.n})`, ok: n === null || n >= x.n, actual: n ?? '—', meta: x.n }; }
  if (x.tipo === 'alcance') { const n = g.elecciones ? g.elecciones.alcance ?? 'local' : null, orden = ['local', 'distrito', 'provincial', 'nacional']; return { id: 'alcance', texto: `Alcance ${x.nivel}`, ok: n === null || orden.indexOf(n) >= orden.indexOf(x.nivel), actual: n ?? '—', meta: null }; }
  if (x.tipo === 'elecciones') { const n = g.elecciones?.participaciones ?? 0; return { id: 'elecciones', texto: `Elecciones vividas desde adentro (${x.n})`, ok: n >= x.n, actual: n, meta: x.n }; }
  return { id: x.tipo, texto: x.tipo, ok: true, actual: '—', meta: null };
}

// El jugador pide el ascenso. Devuelve null si salió bien o el motivo si no.
export function ascender(g) {
  const q = requisitos(g);
  if (!q) return 'Ya estás en la cima.';
  if (!q.todos) return 'Todavía no cumplís todos los requisitos.';
  const prev = g.player.rank;
  g.player.rank = q.destino;
  g.plantel.ocupados[q.destino] = ocupados(g, q.destino) + 1;
  if (prev > 0) {                                                        // dejás tu puesto: alguien lo cubrirá
    g.plantel.ocupados[prev] = Math.max(0, ocupados(g, prev) - 1);
    g.plantel.refill.push({ nivel: prev, dia: g.day + E(g).refillDias });
  }
  g.plantel.avisoAscenso = null;
  linea.alAscender(g);
  personaje.alAscender(g);
  g.note(`¡Ascendiste a ${g.rankName}!`, 'promo');
  g.emit('promotion');
  return null;
}

// Avisa (una sola vez) cuando ya cumplís todo para pedir el ascenso
export function revisarAviso(g) {
  const q = requisitos(g);
  if (!q || !q.todos) { if (g.plantel.avisoAscenso !== null && (!q || !q.todos)) g.plantel.avisoAscenso = null; return; }
  if (g.plantel.avisoAscenso === q.destino) return;
  g.plantel.avisoAscenso = q.destino;
  g.note(`Ya cumplís los requisitos para pedir el ascenso a ${q.rango}. Hacelo desde Partido.`, 'promo');
}

// Turno diario: los puestos vacíos se cubren con el tiempo y el líder superior puede irse
export function tick(g, rnd = Math.random) {
  const S = g.plantel;
  for (const r of [...S.refill]) {
    if (g.day < r.dia) continue;
    S.refill = S.refill.filter(x => x !== r);
    if (ocupados(g, r.nivel) < puestos(g, r.nivel)) {
      S.ocupados[r.nivel] = ocupados(g, r.nivel) + 1;
      if (r.nivel === g.player.rank + 1 && !g.linea.lider) {
        g.linea.lider = linea.nuevoLider(g, `r${g.day}`);
        if (g.linea.lider) g.note(`Nuevo superior en tu partido: ${g.linea.lider.nombre} (${g.linea.lider.cargo}).`, 'linea');
      }
    }
  }
  if (fundador(g)) return;
  if (g.day > 0 && g.day % 30 === 0 && g.linea?.lider) {
    const l = g.linea.lider, nivel = g.player.rank + 1;
    const p = E(g).bajaLiderMensual * (1 + (100 - l.relacion) / 100 + l.ambicion / 100) / 2;
    if (rnd() < p) {
      g.note(`${l.nombre} dejó su cargo de ${l.cargo}: el puesto quedó vacante.`, 'linea');
      S.ocupados[nivel] = Math.max(0, ocupados(g, nivel) - 1);
      S.refill.push({ nivel, dia: g.day + E(g).refillDias });
      g.linea.lider = null; g.linea.directiva = null;
      revisarAviso(g);
    }
  }
}
