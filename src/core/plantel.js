// Plantel del partido: personas con nombre en cargos y como referentes de barrio, vacantes y reemplazos,
// deserciones (se bajan o se pasan a un rival) y los cuadros de los partidos rivales. Sin DOM.
import { rng } from './city.js';
import * as personaje from './personaje.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = Number.isFinite;
const C = g => g.cfg.plantel;
const entre = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const limpia = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 60);

// ---------- Personas ----------
function persona(g, r, { cap = [25, 90], lealtad = [35, 90], ambicion = [10, 90], origen = 'externo' } = {}) {
  const cat = (g.cfg.principios?.principios ?? []).map(p => p.id), pr = [];
  while (pr.length < 2 && cat.length >= 2) { const id = cat[Math.floor(r() * cat.length)]; if (!pr.includes(id)) pr.push(id); }
  const N = C(g).nombres;
  return {
    id: `m${g.plantel.sig++}`,
    nombre: `${N.nombre[Math.floor(r() * N.nombre.length)]} ${N.apellido[Math.floor(r() * N.apellido.length)]}`,
    capacidad: entre(r, ...cap), lealtad: entre(r, ...lealtad), ambicion: entre(r, ...ambicion), principios: pr, origen,
  };
}

export function iniciar(g) {
  const E = g.cfg.escalafon, ocupados = Object.fromEntries(Object.keys(E.requisitos).map(k => [k, 1]));
  const st = { miembros: [], vacantes: [], ocupados, refill: [], sig: 1, avisoAscenso: null, modos: {} };
  g.plantel = st;                                  // persona() usa el contador de ids
  const r = rng(`${g.prov.id}:${g.partido.nombre}:plantel`);
  for (let i = 0; i < C(g).fundadores; i++) st.miembros.push({ ...persona(g, r, { cap: [35, 70], lealtad: [60, 90], origen: 'fundador' }), cargo: null, desde: 0 });
  return st;
}

// Cuadros de los rivales: un líder y dos más, visibles en la pestaña Rivales
// Suma cuadros nuevos con nombre (los usa el desprendimiento: gente que se va con vos)
export function agregarCuadros(g, n, { cap = [30, 65], lealtad = [50, 85], origen = 'externo', seed = '' } = {}) {
  const r = rng(`${g.prov.id}:${g.partido.nombre}:cuadros:${seed}`);
  for (let i = 0; i < n; i++) g.plantel.miembros.push({ ...persona(g, r, { cap, lealtad, origen }), cargo: null, desde: g.day });
}

export function iniciarRivales(g, rivales) {
  const out = {};
  for (const x of rivales) {
    const r = rng(`${g.prov.id}:${x.id}:cuadros`);
    out[x.id] = ['Líder', 'Cuadro', 'Cuadro'].map((rol, i) => ({ ...persona(g, r, { cap: [40, 90], lealtad: [45, 95], ambicion: [10, 85], origen: 'rival' }), rol }));
  }
  return out;
}

// ---------- Etapa del partido y afiliados ----------
export function etapa(g) {
  const a = g.afiliados;
  return [...C(g).etapas].reverse().find(e => a >= (e.desde ? g.umbral(e.desde) : 0)) ?? C(g).etapas[0];
}

// ---------- Cargos y bonos ----------
export const cargoDef = (g, id) => C(g).cargos.find(c => c.id === id);
// Cargos que existen en tu partido: los de Fundar (apoderado, fiscalización) no existen si te sumaste a otro
export const cargosDe = g => C(g).cargos.filter(c => !c.soloFundador || g.modo === 'fundador');
export const titular = (g, cargo) => g.plantel.miembros.find(m => m.cargo === cargo) ?? null;
export const referenteDe = (g, zonaId) => g.plantel.miembros.find(m => m.cargo === `ref:${zonaId}`) ?? null;
export const vacanteDe = (g, key) => g.plantel.vacantes.find(v => (v.cargo ?? `ref:${v.zona}`) === key) ?? null;
// ---------- Jerarquía: solo administrás lo que está por debajo de tu rango ----------
// Afiliados sin el bono de Organización interna (evita la circularidad con g.afiliados)
const afilBase = g => g.followers * g.cfg.economia.tasaAfiliacion * personaje.afiliacionMult(g);
export const puedoAdministrar = (g, cargo) => { const c = cargoDef(g, cargo); if (!c || (c.soloFundador && g.modo !== 'fundador')) return false; return (g.modo === 'fundador' || g.player.rank > c.rango) && afilBase(g) >= g.umbral(c.desdeAfiliados); };   // quien funda no tiene a nadie por encima: todo cargo es suyo
export const rangoDe = (g, c) => g.rangos[c.rango + 1] ?? '';   // rango mínimo del jugador para mandar sobre el cargo
export const modo = (g, cargo) => (g.plantel.modos?.[cargo] === 'delegado' ? 'delegado' : 'propio');
// Habilidad personal aplicada al cargo cuando lo manejás vos (0..1 de capacidad)
export function capPropia(g, c) { const K = C(g).propio; return Math.min(K.tope, personaje.nivel(g, c.habilidad) * K.porNivel); }
// Cargos que hoy manejás vos (cuestan tiempo y desgaste)
export const cargosPropios = g => cargosDe(g).filter(c => puedoAdministrar(g, c.id) && modo(g, c.id) === 'propio');
export function carga(g) { const K = C(g).propio, n = Math.min(K.cargaMax, cargosPropios(g).length); return { n, desgaste: n * K.cargaDesgaste, tiempo: n * K.cargaTiempo }; }
// Quién aporta y con cuánta capacidad (0..100): vos, el titular o nadie
export function aporte(g, cargo) {
  const c = cargoDef(g, cargo);
  if (!c || !puedoAdministrar(g, cargo)) return { cap: 0, quien: null, modo: null };
  if (modo(g, cargo) === 'delegado') { const t = titular(g, cargo); return { cap: t?.capacidad ?? 0, quien: t?.nombre ?? null, modo: 'delegado' }; }
  return { cap: capPropia(g, c), quien: g.jugador?.nombre ?? 'vos', modo: 'propio' };
}
// 0..1: qué tanto aporta el cargo (0 si no es tuyo o está vacante)
export const bono = (g, cargo) => aporte(g, cargo).cap / 100;

// Delegar un cargo: abre la vacante. Retomarlo: volvés a manejarlo y el titular queda sin cargo.
export function delegar(g, cargo) {
  const c = cargoDef(g, cargo);
  if (!c) return 'Ese cargo no existe.';
  if (g.modo !== 'fundador' && g.player.rank <= c.rango) return `Ese cargo lo maneja la conducción: necesitás ser ${rangoDe(g, c)}.`;
  if (g.afiliados < g.umbral(c.desdeAfiliados)) return `Todavía no hay estructura: hacen falta ${g.umbral(c.desdeAfiliados)} afiliados.`;
  if (modo(g, cargo) === 'delegado') return 'Ya está delegado.';
  g.plantel.modos[cargo] = 'delegado';
  abrirVacante(g, { cargo });
  g.note(`Vas a delegar ${c.nombre.toLowerCase()}: elegí a alguien en Partido → Plantel.`, 'linea');
  return null;
}
export function retomar(g, cargo) {
  const c = cargoDef(g, cargo);
  if (!c || modo(g, cargo) !== 'delegado') return 'Ese cargo ya lo manejás vos.';
  g.plantel.modos[cargo] = 'propio';
  g.plantel.vacantes = g.plantel.vacantes.filter(v => v.cargo !== cargo);
  const t = titular(g, cargo);
  if (t) { t.cargo = null; t.lealtad = clamp(t.lealtad - 8, 0, 100); }
  g.note(`Retomaste ${c.nombre.toLowerCase()}${t ? `; ${t.nombre} quedó sin cargo` : ''}. Ahora lo manejás vos.`, 'info');
  return null;
}

// ---------- Vacantes ----------
function candidatos(g, key) {
  const V = C(g).vacante, r = rng(`${g.prov.id}:${g.day}:${key}:${g.plantel.sig}`), out = [];
  const libres = g.plantel.miembros.filter(m => !m.cargo).sort((a, b) => b.capacidad - a.capacidad);
  if (libres[0]) out.push({ id: `c_${libres[0].id}`, miembroId: libres[0].id, nombre: libres[0].nombre, capacidad: libres[0].capacidad, lealtad: libres[0].lealtad, ambicion: libres[0].ambicion, principios: libres[0].principios, origen: 'interno', costo: 0 });
  while (out.length < V.candidatos) {
    const p = persona(g, r, { origen: 'externo' });
    out.push({ ...p, id: `c_${p.id}`, costo: Math.round(p.capacidad * V.costoPorCap) });
  }
  return out;
}

function abrirVacante(g, { cargo, zona }) {
  const key = cargo ?? `ref:${zona}`;
  if (vacanteDe(g, key) || (cargo ? titular(g, cargo) : referenteDe(g, zona))) return null;
  const v = { id: `v${g.day}_${g.plantel.vacantes.length}_${key}`, cargo, zona, abierta: g.day, vence: g.day + C(g).vacante.dias, candidatos: candidatos(g, key) };
  g.plantel.vacantes.push(v);
  const nombre = cargo ? cargoDef(g, cargo).nombre : `referente de ${g.zonas[zona].nombre}`;
  g.note(`Vacante: ${nombre}. Elegí a alguien en Partido → Plantel (si no, queda un interino).`, 'linea');
  return v;
}

export const nombreVacante = (g, v) => (v.cargo ? cargoDef(g, v.cargo).nombre : `Referente de ${g.zonas[v.zona]?.nombre ?? 'un barrio'}`);

// El jugador designa a un candidato. Devuelve null si salió bien o el motivo si no.
export function designar(g, vid, cid) {
  const v = g.plantel.vacantes.find(x => x.id === vid), c = v?.candidatos.find(x => x.id === cid);
  if (!v || !c) return 'Esa vacante ya no existe.';
  if (c.costo > 0 && c.costo > g.player.money) return 'Falta dinero para incorporarlo.';
  g.player.money -= c.costo;
  let m = c.miembroId ? g.plantel.miembros.find(x => x.id === c.miembroId) : null;
  if (!m) { m = { id: c.id.replace(/^c_/, ''), nombre: c.nombre, capacidad: c.capacidad, lealtad: c.lealtad, ambicion: c.ambicion, principios: c.principios, origen: c.origen, desde: g.day, cargo: null }; g.plantel.miembros.push(m); }
  m.cargo = v.cargo ?? `ref:${v.zona}`;
  g.plantel.vacantes = g.plantel.vacantes.filter(x => x !== v);
  g.note(`Designaste a ${m.nombre} como ${nombreVacante(g, v).toLowerCase()} (capacidad ${m.capacidad}).`, 'ok');
  return null;
}

// El coordinador territorial cubre solo un referente de barrio, con calidad parecida a la suya
function autocubrir(g, v, coord) {
  const r = rng(`${g.prov.id}:${g.day}:auto:${v.id}`);
  const m = { ...persona(g, r, { cap: [clamp(coord.capacidad - 20, 15, 95), clamp(coord.capacidad + 5, 20, 100)], lealtad: [45, 85], origen: 'interno' }), cargo: `ref:${v.zona}`, desde: g.day };
  g.plantel.miembros.push(m);
  g.plantel.vacantes = g.plantel.vacantes.filter(x => x !== v);
  g.note(`${coord.nombre} designó a ${m.nombre} como referente de ${g.zonas[v.zona]?.nombre ?? 'un barrio'}.`, 'info');
}

function interino(g, v) {
  const I = C(g).interino, r = rng(`${g.prov.id}:${g.day}:interino:${v.id}`);
  const m = { ...persona(g, r, { cap: I.capacidad, lealtad: [I.lealtad, I.lealtad], origen: 'interino' }), cargo: v.cargo ?? `ref:${v.zona}`, desde: g.day };
  g.plantel.miembros.push(m);
  g.plantel.vacantes = g.plantel.vacantes.filter(x => x !== v);
  g.note(`Nadie ocupó ${nombreVacante(g, v).toLowerCase()}: quedó un interino, ${m.nombre} (capacidad ${m.capacidad}).`, 'bad');
}

// ---------- Bajas ----------
function baja(g, m, motivo, rivalId = null) {
  g.alBajarMiembro?.(m);
  g.plantel.miembros = g.plantel.miembros.filter(x => x !== m);
  if (rivalId && g.rivalesPlantel[rivalId]) {
    g.rivalesPlantel[rivalId].push({ id: m.id, nombre: m.nombre, capacidad: m.capacidad, lealtad: m.lealtad, ambicion: m.ambicion, principios: m.principios, origen: 'rival', rol: 'Cuadro' });
    const lista = g.rivalesPlantel[rivalId];
    while (lista.length > 5) { const i = lista.findIndex(x => x.rol !== 'Líder'); lista.splice(i < 0 ? 0 : i, 1); }   // nunca se descarta al líder
  }
  const rol = m.cargo ? (m.cargo.startsWith('ref:') ? `referente de ${g.zonas[m.cargo.slice(4)]?.nombre ?? 'un barrio'}` : cargoDef(g, m.cargo)?.nombre) : 'militante';
  g.note(`${m.nombre} (${rol}) ${motivo}.`, rivalId ? 'rival' : 'bad');
}

const rivalesPorAfinidad = (g, m) => (g.cfg.partidos?.partidos ?? []).filter(p => p.id !== 'otros' && p.id !== g.partidoBase)
  .map(p => ({ id: p.id, w: 1 + 2 * p.principios.filter(x => m.principios.includes(x)).length }));

// Captación de un rival contra uno de tus cuadros. Devuelve el resultado para mostrar.
export function captacionRival(g, rivalId, rnd = Math.random) {
  const r = g.rival(rivalId), cand = g.plantel.miembros.slice().sort((a, b) => (b.ambicion + 100 - b.lealtad) - (a.ambicion + 100 - a.lealtad))[0];
  if (!cand) return;
  const p = clamp(0.15 + (100 - cand.lealtad) / 160 + cand.ambicion / 400, 0.05, 0.8);
  if (rnd() < p) baja(g, cand, `aceptó la oferta de ${r.nombre} y se pasó a ese partido`, rivalId);
  else { cand.lealtad = clamp(cand.lealtad + 5, 0, 100); g.note(`${r.nombre} intentó llevarse a ${cand.nombre}, pero rechazó la oferta (ahora es más leal).`, 'rival'); }
}

// Probabilidad estimada de captar a un cuadro rival
export const probCaptar = m => clamp(0.1 + (100 - m.lealtad) / 200 + m.ambicion / 300, 0.05, 0.6);

// El jugador intenta captar a un cuadro (no líder) de un rival. Devuelve null o el motivo del fallo.
export function captarCuadro(g, rivalId, mid, con = 'blanco', rnd = Math.random) {
  const lista = g.rivalesPlantel[rivalId], x = lista?.find(m => m.id === mid);
  if (!x || x.rol === 'Líder') return 'No se puede captar a ese cuadro.';
  const K = C(g).captar, cuenta = con === 'negro' ? 'black' : 'money', costo = con === 'negro' ? K.costoNegro : K.costoBlanco;
  if (g.player[cuenta] < costo) return `Falta dinero ${con === 'negro' ? 'negro' : 'blanco'}.`;
  g.player[cuenta] -= costo;
  if (con === 'negro') g.exposure = clamp(g.exposure + K.exposicionNegro, 0, 100);
  const r = g.rival(rivalId);
  if (rnd() < probCaptar(x)) {
    g.rivalesPlantel[rivalId] = lista.filter(m => m !== x);
    g.plantel.miembros.push({ id: `m${g.plantel.sig++}`, nombre: x.nombre, capacidad: x.capacidad, lealtad: clamp(x.lealtad, 40, 85), ambicion: x.ambicion, principios: x.principios, origen: 'captado', cargo: null, desde: g.day });
    const nuevo = persona(g, rng(`${g.prov.id}:${g.day}:reemplazo:${rivalId}`), { cap: [30, 70], origen: 'rival' });
    g.rivalesPlantel[rivalId].push({ ...nuevo, rol: 'Cuadro' });
    g.note(`${x.nombre} dejó ${r.nombre} y se sumó a tu partido.`, 'ok');
  } else g.note(`${x.nombre} rechazó tu oferta. ${r.nombre} se enteró del intento.`, 'bad');
  return null;
}

// Probabilidad diaria de que un miembro abandone (la usa el turno y la ficha de persona)
export function riesgo(g, m) {
  const P = C(g), mult = (1 - 0.25 * bono(g, 'interna')) * personaje.desercionMult(g), rojos = g.economia?.enRojos ? 1.5 : 1;
  return P.desercion.base * (1 + (100 - m.lealtad) / 40) * (1 + m.ambicion / 150) * (1 + g.exposure / 80) * rojos * mult * (m.cargo ? 1 : 0.5);
}
export const riesgoMensual = (g, m) => 1 - Math.pow(1 - riesgo(g, m), 30);
export const antiguedad = (g, m) => Math.max(0, g.day - (m.desde ?? 0));

// ---------- Turno diario ----------
export function tick(g, rnd = Math.random) {
  const S = g.plantel, P = C(g), afil = g.afiliados;
  // 0) lo que quedó fuera de tu mando (guardados viejos, retrocesos) vuelve a la conducción
  for (const c of cargosDe(g)) if (!puedoAdministrar(g, c.id)) { const t = titular(g, c.id); if (t) t.cargo = null; S.vacantes = S.vacantes.filter(v => v.cargo !== c.id); }
  const rangoRef = g.modo === 'fundador' || g.player.rank > P.referente.rango;
  if (!rangoRef) S.vacantes = S.vacantes.filter(v => !v.zona);
  // 1) solo se cubren los cargos que decidiste delegar
  for (const c of cargosDe(g)) if (puedoAdministrar(g, c.id) && modo(g, c.id) === 'delegado' && !titular(g, c.id)) abrirVacante(g, { cargo: c.id });
  // 2) referentes de barrio: si delegaste el Territorial los cubre el coordinador; si no, los cubrís vos
  const coord = modo(g, 'territorial') === 'delegado' ? titular(g, 'territorial') : null;
  const cupo = Math.floor(afil / g.umbral(P.referente.porAfiliados)) + 1;
  const refs = S.miembros.filter(m => m.cargo?.startsWith('ref:')).length + S.vacantes.filter(v => v.zona).length;
  if (rangoRef && refs < cupo && afil >= g.umbral(P.cargos[0].desdeAfiliados)) {
    const z = Object.values(g.zonas).filter(z => z.control >= P.referente.control && !referenteDe(g, z.id) && !vacanteDe(g, `ref:${z.id}`)).sort((a, b) => b.control * b.pop - a.control * a.pop)[0];
    if (z) abrirVacante(g, { zona: z.id });
  }
  if (coord) for (const v of S.vacantes.filter(v => v.zona)) autocubrir(g, v, coord);
  // 3) vacantes que vencen: queda un interino
  for (const v of [...S.vacantes]) if (g.day >= v.vence) interino(g, v);
  // 4) deserciones
  for (const m of [...S.miembros]) {
    const h = riesgo(g, m);
    if (rnd() >= h) continue;
    if (g.exposure > 60 && rnd() < 0.5) baja(g, m, 'renunció por los escándalos del partido');
    else if (m.ambicion > 55 && rnd() < 0.6) {
      const rs = rivalesPorAfinidad(g, m), tot = rs.reduce((s, x) => s + x.w, 0);
      let x = rnd() * tot, rv = rs[0];
      for (const q of rs) { x -= q.w; if (x <= 0) { rv = q; break; } }
      baja(g, m, `se pasó a ${g.rival(rv.id).nombre}`, rv.id);
    } else baja(g, m, 'se bajó del partido por razones personales');
  }
}

// ---------- Restauración segura desde un guardado ----------
export function sanear(g, raw) {
  const base = iniciar(g);
  if (!raw || typeof raw !== 'object') return base;
  const cat = (g.cfg.principios?.principios ?? []).map(p => p.id);
  const cargosOk = new Set(C(g).cargos.map(c => c.id));
  const cargoOk = c => c === null || cargosOk.has(c) || (typeof c === 'string' && c.startsWith('ref:') && !!g.zonas[c.slice(4)]);
  const limpiaP = x => ({ id: String(x.id).replace(/[^\w:-]/g, '').slice(0, 40), nombre: limpia(x.nombre) || 'Sin nombre', capacidad: clamp(Math.round(x.capacidad), 0, 100), lealtad: clamp(Math.round(x.lealtad), 0, 100), ambicion: clamp(Math.round(x.ambicion), 0, 100), principios: (Array.isArray(x.principios) ? [...new Set(x.principios)] : []).filter(id => cat.includes(id)).slice(0, 2), origen: ['fundador', 'interno', 'externo', 'captado', 'interino', 'rival'].includes(x.origen) ? x.origen : 'externo' });
  const okP = x => x && typeof x.id === 'string' && [x.capacidad, x.lealtad, x.ambicion].every(fin);
  const out = { miembros: [], vacantes: [], ocupados: { ...base.ocupados }, refill: [], sig: fin(raw.sig) ? Math.max(1, Math.floor(raw.sig)) : base.sig, avisoAscenso: fin(raw.avisoAscenso) ? raw.avisoAscenso : null, modos: {} };
  if (Array.isArray(raw.miembros)) {
    const usados = new Set();
    for (const m of raw.miembros.filter(okP).slice(0, 60)) {
      const cargo = cargoOk(m.cargo ?? null) ? (m.cargo ?? null) : null;
      if (cargo && usados.has(cargo)) continue;
      if (cargo) usados.add(cargo);
      out.miembros.push({ ...limpiaP(m), cargo, desde: fin(m.desde) ? m.desde : 0 });
    }
  } else out.miembros = base.miembros;
  if (Array.isArray(raw.vacantes)) {
    out.vacantes = raw.vacantes.filter(v => v && typeof v.id === 'string' && fin(v.abierta) && fin(v.vence) && (v.cargo ? cargosOk.has(v.cargo) : !!g.zonas[v.zona]) && Array.isArray(v.candidatos)).slice(0, 20).map(v => ({
      id: String(v.id).slice(0, 80), cargo: v.cargo ?? undefined, zona: v.cargo ? undefined : v.zona, abierta: v.abierta, vence: v.vence,
      candidatos: v.candidatos.filter(okP).slice(0, 5).map(c => ({ ...limpiaP(c), miembroId: typeof c.miembroId === 'string' ? c.miembroId.slice(0, 40) : undefined, costo: clamp(Math.round(Number(c.costo) || 0), 0, 1e6) })),
    })).filter(v => v.candidatos.length);
  }
  for (const c of C(g).cargos) out.modos[c.id] = raw.modos && typeof raw.modos === 'object' ? (raw.modos[c.id] === 'delegado' ? 'delegado' : 'propio') : (out.miembros.some(m => m.cargo === c.id) ? 'delegado' : 'propio');
  if (raw.ocupados && typeof raw.ocupados === 'object') for (const k of Object.keys(out.ocupados)) if (fin(raw.ocupados[k])) out.ocupados[k] = clamp(Math.floor(raw.ocupados[k]), 0, 99);
  if (Array.isArray(raw.refill)) out.refill = raw.refill.filter(r => r && fin(r.dia) && out.ocupados[String(r.nivel)] !== undefined).slice(0, 20).map(r => ({ nivel: Number(r.nivel), dia: r.dia }));
  return out;
}

export function sanearRivales(g, raw, rivales) {
  const sig = g.plantel.sig;                       // generar los de respaldo no debe gastar ids del jugador
  const base = iniciarRivales(g, rivales), cat = (g.cfg.principios?.principios ?? []).map(p => p.id);
  g.plantel.sig = sig;
  if (!raw || typeof raw !== 'object') return base;
  for (const x of rivales) {
    const lista = raw[x.id];
    if (!Array.isArray(lista)) continue;
    const ok = lista.filter(m => m && typeof m.id === 'string' && [m.capacidad, m.lealtad, m.ambicion].every(fin)).slice(0, 6)
      .map(m => ({ id: String(m.id).replace(/[^\w:-]/g, '').slice(0, 40), nombre: limpia(m.nombre) || 'Sin nombre', capacidad: clamp(Math.round(m.capacidad), 0, 100), lealtad: clamp(Math.round(m.lealtad), 0, 100), ambicion: clamp(Math.round(m.ambicion), 0, 100), principios: (Array.isArray(m.principios) ? m.principios : []).filter(id => cat.includes(id)).slice(0, 2), origen: 'rival', rol: m.rol === 'Líder' ? 'Líder' : 'Cuadro' }));
    if (ok.length && ok.some(m => m.rol === 'Líder')) base[x.id] = ok;
  }
  return base;
}
