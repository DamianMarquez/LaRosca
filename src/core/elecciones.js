// Elecciones: calendario bienal, proceso por fases, listas, frentes, encuestas, resultados y cargos electivos. Sin DOM.
// Fase 2: contiendas municipales (la capital que se juega). Las provinciales y nacionales se activan desde data/elecciones.json.
import { rng } from './city.js';
import { Clock } from './clock.js';
import { presencia, presenciaCiudad, rivales } from './rivals.js';
import { relacion } from './pactos.js';
import { perfil } from './electoral.js';
import { fiscalizacion, esFundador } from './organizacion.js';
import { cambiarRelacion } from './pactos.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = Number.isFinite;
const K = g => g.cfg.elecciones;
const ALCANCES = ['local', 'distrito', 'provincial', 'nacional'];
export const FASES = ['espera', 'convocatoria', 'alianzas', 'listas', 'paso', 'campana', 'veda', 'elegido', 'asumido'];
export const FASE_NOMBRE = { espera: 'Sin convocatoria', convocatoria: 'Convocatoria', alianzas: 'Frentes y alianzas', listas: 'Cierre de listas', paso: 'PASO', campana: 'Campaña', veda: 'Veda electoral', elegido: 'Escrutinio', asumido: 'Asunción' };

// ---------- Calendario ----------
const domingo = (anio, mes, n) => { const w = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay(); return 1 + ((7 - w) % 7) + 7 * (n - 1); };
export const tipoDe = (cfg, anio) => ((anio - cfg.elecciones.anioEjecutivo) % 4 === 0 ? 'ejecutiva' : 'legislativa');
export const fechasDe = anio => ({ paso: Clock.dayOf(anio, 8, domingo(anio, 8, 2)), general: Clock.dayOf(anio, 10, domingo(anio, 10, 4)), balotaje: Clock.dayOf(anio, 11, domingo(anio, 11, 3)), asuncion: Clock.dayOf(anio, 12, 10) });
// Primer año impar (desde 2025) cuyo proceso todavía no terminó
export function anioProximo(cfg, day) { for (let a = cfg.elecciones.primerAnio; a < 2200; a += 2) if (fechasDe(a).asuncion >= day) return a; return 2201; }

// ---------- Partidos que compiten ----------
export const claveMia = g => (g.modo === 'fundador' ? 'yo' : g.partidoBase);
export function nombrePartido(g, id) {
  if (id === 'yo' || id === g.partidoBase) return g.partido.nombre;
  if (id === 'otros') return 'Otros y en blanco';
  return g.cfg.partidos.partidos.find(p => p.id === id)?.nombre ?? id;
}
export const colorPartido = (g, id) => (id === 'yo' ? '#d9a441' : id === 'otros' ? '#6b7586' : g.cfg.partidos.partidos.find(p => p.id === id)?.color ?? '#6b7586');

// ---------- Alcance del partido: a qué contiendas puede presentarse ----------
export function alcanceDe(g) {
  if (g.modo !== 'fundador') return 'nacional';          // un partido existente ya tiene reconocimiento
  return { distrito: 'distrito', provincial: 'provincial', nacional: 'nacional' }[g.org?.estado] ?? 'local';   // lo da el estado legal de tu partido
}
const ordenAlcance = a => ALCANCES.indexOf(a);
export const contiendasDe = (g, tipo) => K(g).contiendas.filter(c => c.activa && c.ciclos.includes(tipo));
export const contiendaDef = (g, id) => K(g).contiendas.find(c => c.id === id);
export const puedePresentar = (g, c) => g.modo !== 'fundador' || ordenAlcance(alcanceDe(g)) >= ordenAlcance(c.requiere.alcance);

// ---------- Distritos (provincial y nacional) ----------
const distritosIds = g => Object.keys(g.cfg.datos?.provincias ?? {}).filter(iso => g.cfg.historicos?.distritos?.[iso]).sort();
const electoresDe = (g, iso) => g.cfg.datos?.provincias?.[iso]?.electores2025 ?? 0;
const turnoSenado = (g, anio) => (((anio - K(g).primerAnio) / 2) % 3 + 3) % 3;
// Bancas que se renuevan en un distrito para una contienda
function bancasDistrito(g, c, iso, anio) {
  const B = c.bancas ?? {}, e = electoresDe(g, iso);
  if (c.sistema === 'unipersonal') return 1;
  if (B.tipo === 'senado') return distritosIds(g).indexOf(iso) % 3 === turnoSenado(g, anio) ? 3 : 0;
  if (B.tipo === 'diputados') { const T = distritosIds(g).reduce((s, d) => s + electoresDe(g, d), 0) || 1; return Math.ceil(Math.max(B.min, Math.round(B.total * e / T)) * c.renovacion); }
  const total = Math.round(clamp(B.base + (e / 1e6) * B.porMillon, B.min, B.max));
  return Math.max(1, Math.ceil(total * c.renovacion));
}
// Bancas en juego en esta elección para una contienda (en la capital, en la provincia o en todo el país)
export function bancasEnJuego(g, c, anio) {
  if (c.sistema === 'unipersonal') return 1;
  if (c.ambito === 'nacional') return distritosIds(g).reduce((s, iso) => s + bancasDistrito(g, c, iso, anio), 0);
  if (c.ambito === 'provincial') return bancasDistrito(g, c, g.prov.id, anio);
  const b = c.bancas, pop = Object.values(g.zonas).reduce((s, z) => s + z.pop, 0);
  const total = Math.round(clamp(b.base + (pop / 1e6) * b.porMillon, b.min, b.max));
  return Math.max(1, Math.ceil(total * c.renovacion));
}
const escalaMonto = (g, x) => Math.max(1, Math.round(x * clamp(g.escala, 0.35, 1)));
export const costoLista = (g, c) => escalaMonto(g, c.costo);
export const costoEncuesta = g => escalaMonto(g, K(g).encuesta.costo);

// ---------- Estado ----------
export function iniciar() {
  return { proceso: null, historial: [], cargos: [], clima: {}, bancas: 0, alcance: 'local', participaciones: 0, sig: 1 };
}

function nuevoProceso(g, anio) {
  const tipo = tipoDe(g.cfg, anio), fechas = fechasDe(anio);
  const contiendas = {};
  for (const c of contiendasDe(g, tipo)) contiendas[c.id] = { id: c.id, estado: 'abierta', lista: [], lugar: null, bancas: bancasEnJuego(g, c, anio) };
  const P0 = null;
  return { anio, tipo, fechas, fase: 'espera', contiendas, frentes: [], cupos: {}, cupoIntentos: {}, encuestas: [], campana: {}, resultados: [] };
}

// Cargos electivos vigentes (y cuántos son tuyos)
export const cargosVigentes = g => g.elecciones.cargos.filter(c => c.hasta >= g.day);
export const bancasDe = g => cargosVigentes(g).filter(c => (g.modo === 'fundador' ? true : c.quien === 'yo')).length;
export const alcanceMult = g => !g.cfg.elecciones ? 1 : 1 + Math.min(K(g).efectos.alcanceMax, K(g).efectos.alcancePorBanca * bancasDe(g));
export function ingresoMensual(g) {
  let t = 0;
  if (!g.cfg.elecciones) return 0;
  for (const c of cargosVigentes(g)) {
    const d = contiendaDef(g, c.contienda); if (!d) continue;
    const dieta = escalaMonto(g, d.dieta);
    if (c.quien === 'yo') t += dieta;
    else if (g.modo === 'fundador') t += Math.round(dieta * K(g).efectos.aporteFundador);   // tus electos aportan al partido
  }
  return t;
}

// ---------- Fases ----------
function faseObjetivo(g, P) {
  const F = K(g).fases, d = P.fechas.general - g.day;
  if (g.day >= P.fechas.asuncion) return 'asumido';
  if (g.day > P.fechas.general) return 'elegido';
  if (d > F.convocatoria) return 'espera';
  if (d > F.alianzas) return 'convocatoria';
  if (d > F.listas) return 'alianzas';
  if (g.day < P.fechas.paso - K(g).cierreListasAntesPaso) return 'listas';
  if (d > F.campana) return 'paso';
  if (d > F.veda) return 'campana';
  if (d > 0) return 'veda';
  return 'elegido';
}
export const diasHastaGeneral = g => (g.elecciones.proceso ? g.elecciones.proceso.fechas.general - g.day : null);
export const diasParaCierre = g => (g.elecciones.proceso ? g.elecciones.proceso.fechas.paso - K(g).cierreListasAntesPaso - g.day : null);

const aviso = (g, nombre, texto, ok = null) => { g.note(`${nombre}: ${texto}`, 'linea'); g.informar({ tipo: 'eleccion', nombre, zona: null, zonaNombre: '', ok, texto, cambios: [] }); };

function entrar(g, P, fase) {
  const E = g.elecciones, tipoTxt = P.tipo === 'ejecutiva' ? 'ejecutivas' : 'legislativas';
  if (fase === 'convocatoria') aviso(g, `Elecciones ${P.anio}`, `Se convocó a elecciones ${tipoTxt}: se vota el ${Clock.format(P.fechas.general)}. Quedan ${P.fechas.general - g.day} días.`);
  else if (fase === 'alianzas') aviso(g, 'Frentes y alianzas', g.modo === 'fundador' ? 'Se abre el plazo para formar frentes con otros partidos.' : 'Tu partido negocia sus alianzas; podés influir con tu trabajo territorial.');
  else if (fase === 'listas') {
    aviso(g, 'Listas', g.modo === 'fundador' ? `Se abre la presentación de listas hasta el ${Clock.format(P.fechas.paso - K(g).cierreListasAntesPaso)}.` : `Tu partido arma sus listas hasta el ${Clock.format(P.fechas.paso - K(g).cierreListasAntesPaso)}: podés pedir un lugar.`);
  } else if (fase === 'paso') {
    cerrarListas(g, P);
    const ps = Object.values(P.contiendas)[0];
    if (ps) { const r = proyectar(g, P, ps.id, 0.03); if (r) P.encuestas.push({ dia: g.day, contienda: ps.id, pct: redondear(r.pct), margen: 0.03, origen: 'PASO' }); }
    aviso(g, 'Primarias (PASO)', 'Se realizaron las PASO: sirven de termómetro. Mirá el resultado orientativo en Elecciones.');
  } else if (fase === 'campana') aviso(g, 'Campaña', 'Arrancó la campaña: tus misiones exitosas pesan más en los barrios. Podés encargar encuestas.');
  else if (fase === 'veda') g.note('Veda electoral: terminó la campaña. Todo se define en las urnas.', 'linea');
  else if (fase === 'elegido') escrutinio(g, P);
  else if (fase === 'asumido') { asumir(g, P); E.proceso = null; }
}

const redondear = pct => Object.fromEntries(Object.entries(pct).map(([k, v]) => [k, +v.toFixed(4)]));

function cerrarListas(g, P) {
  for (const [cid, cu] of Object.entries(P.cupos ?? {})) if (!cu.lista.length) armarCupo(g, cid);   // si no elegiste candidatos, entran los mejores
  for (const c of Object.values(P.contiendas)) {
    if (g.modo !== 'fundador') { c.estado = 'presentada'; continue; }
    if (c.estado !== 'presentada' && !P.cupos?.[c.id]) { c.estado = 'no_presenta'; if (c.lista.length) c.lista = []; g.note(`No presentaste lista para ${contiendaDef(g, c.id).cargo.toLowerCase()}s: tu partido no compite ahí.`, 'info'); }
  }
}

// ---------- Resultado (nivel capital) ----------
function zonaFuerzas(g, P, z, ids, mia, ctx) {
  const M = K(g).modelo, pf = ctx.base, out = {};
  const r = rng(`${g.prov.id}:${P.anio}:${z.id}`);
  const pres = presencia(g, z.id);
  for (const id of ids) {
    const ruido = 1 + (r() * 2 - 1) * M.ruidoBarrio;
    const clave = id === 'yo' ? 'yo' : id;
    const clima = g.elecciones.clima[clave] ?? 0;
    if (id === 'otros') { out[id] = (pf.otros ?? 0.05) * ruido; continue; }
    if (id === 'yo') {                                             // fundador: sin base histórica, todo sale de tu trabajo
      const opinion = esFundador(g) ? M.opinionPeso * Math.max(0, g.org.fama - 18) / 82 : 0;      // voto de opinión: la fama pesa aunque no haya territorio
      out[id] = (M.controlPeso * z.control + M.confianzaPeso * Math.max(0, (z.trust - 20) / 80) + (P.campana[z.id] ?? 0) + opinion) * (1 - M.escandaloPeso * g.exposure / 100) * (1 + clima);
      continue;
    }
    const base = pf[id] ?? 0.02;
    let local = 1;
    if (id !== g.partidoBase && ctx.presCiudad[id] > 0) local = clamp(Math.sqrt((pres[id] ?? 0) / ctx.presCiudad[id]), 0.6, 1.5);
    let f = base * ruido * (1 + clima) * local;
    if (id === g.partidoBase) f += M.controlPeso * z.control + M.confianzaPeso * Math.max(0, (z.trust - 20) / 80) + (P.campana[z.id] ?? 0) - M.escandaloPeso * (g.exposure / 100) * base;   // tu trabajo mueve a tu partido
    out[id] = Math.max(0, f);
  }
  return out;
}

// ¿Tu partido pone votos propios en esta contienda? (lista propia o cupo en la lista de otro)
const compiteYo = (g, P, c) => (g.modo === 'fundador' ? P.contiendas[c.id]?.estado === 'presentada' || !!P.cupos?.[c.id] : true);
// Con cupo, tus votos van a la lista del socio (la mayoría; el resto se pierde)
function fusionarCupo(votos, cupo, T) {
  if (!cupo || votos.yo === undefined) return votos;
  const y = votos.yo; delete votos.yo;
  votos[cupo.host] = (votos[cupo.host] ?? 0) + y * T; votos.otros = (votos.otros ?? 0) + y * (1 - T);
  return votos;
}

// Votos por partido en la capital. ruido > 0 simula la imprecisión de una encuesta. forzarYo: contar al partido fundador aunque no se presente (para derramar a otros niveles).
function votosCapital(g, P, c, ruido = 0, forzarYo = false) {
  const pfl = g.perfilElectoral[0], base = pfl?.partidos ?? {};
  const rs = rivales(g).map(r => r.id), mia = claveMia(g), compite = forzarYo || compiteYo(g, P, c);
  const ids = [...rs, ...(g.modo !== 'fundador' ? [g.partidoBase] : []), ...(g.modo === 'fundador' && compite ? ['yo'] : []), 'otros'];
  const ctx = { base, presCiudad: Object.fromEntries(rs.map(id => [id, presenciaCiudad(g, id)])) };
  const rr = ruido ? rng(`${g.prov.id}:${P.anio}:enc:${g.day}:${c.id}`) : null;
  const part = clamp((pfl?.participacion ?? 0.75) + (rng(`${g.prov.id}:${P.anio}:part`)() * 2 - 1) * K(g).modelo.participacionRuido, 0.4, 0.95);
  const votos = Object.fromEntries(ids.map(id => [id, 0]));
  let electores = 0;
  for (const z of Object.values(g.zonas)) {
    const e = g.electores(z) ?? Math.round(z.pop * 0.75); electores += e;
    const f = zonaFuerzas(g, P, z, ids, mia, ctx), tot = Object.values(f).reduce((a, b) => a + b, 0) || 1;
    for (const id of ids) votos[id] += e * part * (f[id] / tot);
  }
  if (rr) for (const id of ids) votos[id] *= 1 + (rr() * 2 - 1) * ruido * 2;
  if (votos.yo) votos.yo *= 1 - K(g).modelo.perdidaFiscal * (1 - fiscalizacion(g));   // sin fiscales de mesa, perdés votos
  return { votos, electores, participacion: part };
}

// Votos de un distrito entero (provincial o nacional): historia real del distrito + tu penetración
function votosDistrito(g, P, iso, c, ctx, ruido) {
  const pfl = perfil(g.cfg.historicos, g.cfg.partidos.partidos, iso)[0]; if (!pfl) return null;
  const M = K(g).modelo, home = iso === g.prov.id, r = rng(`${iso}:${P.anio}:dist`), rr = ruido ? rng(`${iso}:${P.anio}:encd:${g.day}`) : null;
  const rs = rivales(g).map(x => x.id), compite = compiteYo(g, P, c);
  const ids = [...rs, ...(g.modo !== 'fundador' ? [g.partidoBase] : []), ...(g.modo === 'fundador' && compite ? ['yo'] : []), 'otros'], f = {};
  for (const id of ids) {
    const ruidoD = 1 + (r() * 2 - 1) * M.ruidoBarrio * 0.6, clima = g.elecciones.clima[id] ?? 0;
    if (id === 'otros') { f[id] = (pfl.partidos.otros ?? 0.05) * ruidoD; continue; }
    if (id === 'yo') { const pen = (home ? K(g).penetracion : K(g).penetracionOtros)[ctx.alcance] ?? 0; f[id] = ctx.miaCap * pen * (1 + clima); continue; }
    f[id] = Math.max(0, (pfl.partidos[id] ?? 0.02) * ruidoD * (1 + clima) + (id === g.partidoBase && home ? ctx.bonusBase : 0));
  }
  const tot = Object.values(f).reduce((a, b) => a + b, 0) || 1, electores = electoresDe(g, iso);
  const part = clamp((pfl.participacion ?? 0.75) + (r() * 2 - 1) * M.participacionRuido, 0.4, 0.95);
  const votos = Object.fromEntries(ids.map(id => [id, electores * part * (f[id] / tot) * (rr ? 1 + (rr() * 2 - 1) * ruido * 2 : 1)]));
  if (votos.yo) votos.yo *= 1 - K(g).modelo.perdidaFiscal * (1 - fiscalizacion(g));
  return { votos, electores, participacion: part };
}

export function dhondt(votos, bancas, minimo = 0) {
  const ids = Object.keys(votos).filter(id => votos[id] >= minimo && votos[id] > 0), out = Object.fromEntries(Object.keys(votos).map(id => [id, 0]));
  for (let i = 0; i < bancas && ids.length; i++) {
    let best = null, bv = -1;
    for (const id of ids) { const q = votos[id] / (out[id] + 1); if (q > bv) { bv = q; best = id; } }
    out[best]++;
  }
  return out;
}

// Reparte bancas de un distrito (D'Hondt con piso o Senado: 2 para la mayoría y 1 para la primera minoría), con frente si lo hay
function repartir(g, c, votos, bancas, electores, frente) {
  const out = Object.fromEntries(Object.keys(votos).map(id => [id, 0]));
  if (!bancas) return out;
  const listas = { ...votos }; delete listas.otros;
  if (frente) { listas.frente = (listas.yo ?? 0) + (listas[frente] ?? 0); delete listas.yo; delete listas[frente]; }
  let rep;
  if (c.sistema === 'senado') {
    const ord = Object.entries(listas).sort((a, b) => b[1] - a[1]); rep = Object.fromEntries(Object.keys(listas).map(id => [id, 0]));
    if (ord[0]) rep[ord[0][0]] = 2; if (ord[1]) rep[ord[1][0]] = 1;
  } else rep = dhondt(listas, bancas, K(g).umbral * electores);
  if (frente) { const sub = dhondt({ yo: votos.yo ?? 0, [frente]: votos[frente] ?? 0 }, rep.frente ?? 0); out.yo = sub.yo; out[frente] = sub[frente]; delete rep.frente; }
  for (const [id, n] of Object.entries(rep)) out[id] = n;
  return out;
}

// Calcula el resultado de una contienda. ruido: error de encuesta (0 = escrutinio real).
function calcular(g, P, cid, ruido = 0) {
  const c = contiendaDef(g, cid), st = P.contiendas[cid];
  if (!c || !st) return null;
  const cupo = g.modo === 'fundador' ? P.cupos?.[cid] ?? null : null, T = K(g).cupo.transferencia;
  const frenteId = cupo ? null : P.frentes[0]?.rival ?? null;       // con cupo, tus votos ya van a la lista del socio
  let votos = {}, electores = 0, partPeso = 0, bancas = {}, hostSeats = 0;
  const sumar = (v, rep, esLocal) => { for (const [id, n] of Object.entries(v.votos)) votos[id] = (votos[id] ?? 0) + n; electores += v.electores; partPeso += v.participacion * v.electores; if (rep) { for (const [id, n] of Object.entries(rep)) bancas[id] = (bancas[id] ?? 0) + n; if (esLocal && cupo) hostSeats = rep[cupo.host] ?? 0; } };
  if (c.ambito === 'municipal') {
    const v = votosCapital(g, P, c, ruido); fusionarCupo(v.votos, cupo, T);
    const fr = frenteId && v.votos.yo !== undefined && v.votos[frenteId] !== undefined ? frenteId : null;
    sumar(v, c.sistema === 'unipersonal' ? null : repartir(g, c, v.votos, st.bancas, v.electores, fr), true);
  } else {
    // Derrame de tu trabajo en la capital hacia el resto del distrito o del país
    const cap = votosCapital(g, P, { id: 'concejales' }, 0, true), tv = Object.values(cap.votos).reduce((a, b) => a + b, 0) || 1;
    const ctrl = Object.values(g.zonas).reduce((s, z) => s + z.control * z.pop, 0) / (Object.values(g.zonas).reduce((s, z) => s + z.pop, 0) || 1);
    const ctx = { alcance: alcanceDe(g), miaCap: (cap.votos.yo ?? 0) / tv, bonusBase: K(g).modelo.derrameBase * K(g).modelo.controlPeso * ctrl };
    for (const iso of (c.ambito === 'provincial' ? [g.prov.id] : distritosIds(g))) {
      const v = votosDistrito(g, P, iso, c, ctx, ruido); if (!v) continue;
      fusionarCupo(v.votos, cupo, T);
      const fr = frenteId && v.votos.yo !== undefined && v.votos[frenteId] !== undefined ? frenteId : null;
      sumar(v, c.sistema === 'unipersonal' ? null : repartir(g, c, v.votos, bancasDistrito(g, c, iso, P.anio), v.electores, fr), iso === g.prov.id);
    }
  }
  const valid = Object.values(votos).reduce((a, b) => a + b, 0) || 1;
  const pct = Object.fromEntries(Object.entries(votos).map(([k, v]) => [k, v / valid]));
  const ord = Object.entries(votos).filter(([id]) => id !== 'otros').sort((a, b) => b[1] - a[1]);
  let ganador = ord[0]?.[0] ?? null, balotaje = null;
  for (const id of Object.keys(votos)) bancas[id] ??= 0;
  if (c.sistema === 'unipersonal') {
    bancas[ganador] = 1;
    if (c.balotaje && ord[1]) {                                       // gana en primera vuelta con 45 %, o con 40 % y 10 puntos de ventaja
      const B = K(g).balotaje, v0 = pct[ord[0][0]], v1 = pct[ord[1][0]];
      if (!(v0 >= B.umbral || (v0 >= B.minimo && v0 - v1 >= B.ventaja))) { balotaje = [ord[0][0], ord[1][0]]; bancas[ganador] = 0; ganador = null; }
    }
  } else if (c.ambito !== 'municipal') ganador = Object.entries(bancas).filter(([id]) => id !== 'otros').sort((a, b) => b[1] - a[1])[0]?.[0] ?? ganador;
  // Cupo: tus candidatos ocupan lugares de la lista del socio; entran los que quedan dentro de las bancas que ganó esa lista
  let cupoRes = null;
  if (cupo && c.sistema !== 'unipersonal') {
    const n = Math.min(cupo.lugares, Math.max(1, cupo.lista.length)), m = (cupo.posiciones ?? K(g).cupo.posiciones).slice(0, n).filter(p => p <= hostSeats).length;
    bancas.yo = m; bancas[cupo.host] = Math.max(0, (bancas[cupo.host] ?? 0) - m);
    cupoRes = { host: cupo.host, m };
  }
  return { contienda: cid, votos, pct, bancas, ganador, balotaje, participacion: electores ? partPeso / electores : 0, electores, frente: frenteId && votos.yo !== undefined ? frenteId : null, cupo: cupoRes };
}
export const proyectar = (g, P, cid, ruido) => calcular(g, P, cid, ruido);

// Balotaje: los votos de los eliminados se reparten por afinidad de principios; una parte se abstiene
function resolverBalotaje(g, P) {
  const b = P.balotaje, r = P.resultados.find(x => x.contienda === b.contienda); if (!r) { P.balotaje = null; return; }
  const [a, z] = b.finalistas, T = K(g).balotaje.transferencia;
  const princ = id => (id === 'yo' || id === g.partidoBase ? g.partido.principios : g.cfg.partidos.partidos.find(p => p.id === id)?.principios ?? []);
  const afin = (x, y) => 1 + 2 * princ(x).filter(p => princ(y).includes(p)).length;
  const tot = { [a]: r.pct[a] ?? 0, [z]: r.pct[z] ?? 0 };
  for (const [id, v] of Object.entries(r.pct)) { if (id === a || id === z) continue; const wa = afin(id, a), wz = afin(id, z), k = id === 'otros' ? 0.5 : 1; tot[a] += v * T * k * wa / (wa + wz); tot[z] += v * T * k * wz / (wa + wz); }
  const gan = tot[a] >= tot[z] ? a : z;
  b.hecho = true; b.ganador = gan; b.pct = { [a]: +(tot[a] / (tot[a] + tot[z])).toFixed(4), [z]: +(tot[z] / (tot[a] + tot[z])).toFixed(4) };
  r.ganador = gan; for (const id of Object.keys(r.bancas)) r.bancas[id] = id === gan ? 1 : 0;
  const h = g.elecciones.historial.find(x => x.anio === P.anio), hr = h?.resultados.find(x => x.contienda === b.contienda);
  if (hr) { hr.ganador = gan; for (const id of Object.keys(hr.bancas)) hr.bancas[id] = id === gan ? 1 : 0; hr.balotaje = { finalistas: [a, z], pct: b.pct }; }
  const mia = claveMia(g), gane = gan === mia;
  aviso(g, 'Balotaje', `${nombrePartido(g, a)} y ${nombrePartido(g, z)} definieron la presidencia: ganó ${nombrePartido(g, gan)} con ${(b.pct[gan] * 100).toFixed(1).replace('.', ',')}%.${[a, z].includes(mia) ? (gane ? ' ¡Tu partido ganó!' : ' Tu partido perdió.') : ''}`, [a, z].includes(mia) ? gane : null);
}

function escrutinio(g, P) {
  const crudos = Object.keys(P.contiendas).map(cid => calcular(g, P, cid, 0)).filter(Boolean);
  P.resultados = crudos.map(r => ({ contienda: r.contienda, pct: redondear(r.pct), bancas: r.bancas, ganador: r.ganador, participacion: +r.participacion.toFixed(3), frente: r.frente, cupo: r.cupo }));
  const mia = claveMia(g), partes = [], bal = crudos.find(r => r.balotaje);
  if (bal) P.balotaje = { contienda: bal.contienda, finalistas: bal.balotaje, hecho: false };
  for (const r of P.resultados) {
    const c = contiendaDef(g, r.contienda), n = r.bancas[mia] ?? 0, pc = r.pct[mia];
    const aBal = P.balotaje && P.balotaje.contienda === r.contienda && P.balotaje.finalistas.includes(mia);
    if (r.cupo) partes.push(`${c.titulo}: cupo en la lista de ${nombrePartido(g, r.cupo.host)}, ${r.cupo.m} banca${r.cupo.m === 1 ? '' : 's'}`);
    else if (pc !== undefined) partes.push(`${c.titulo}: ${(pc * 100).toFixed(1).replace('.', ',')}%${c.sistema === 'unipersonal' ? (r.ganador === mia ? ' (ganaste)' : aBal ? ' (vas a balotaje)' : '') : `, ${n} banca${n === 1 ? '' : 's'}`}`);
  }
  const gano = P.resultados.some(r => (r.bancas[mia] ?? 0) > 0);
  if (P.balotaje) g.note(`Habrá balotaje el ${Clock.format(P.fechas.balotaje)} entre ${nombrePartido(g, P.balotaje.finalistas[0])} y ${nombrePartido(g, P.balotaje.finalistas[1])}.`, 'linea');
  const texto = partes.length ? `Resultados: ${partes.join(' · ')}.` : `Se votó. ${g.modo === 'fundador' ? 'Tu partido no se presentó.' : ''} ${P.resultados.filter(r => r.ganador).slice(0, 4).map(r => `${contiendaDef(g, r.contienda).titulo}: ganó ${nombrePartido(g, r.ganador)}`).join(' · ')}.`;
  g.elecciones.historial.unshift({ anio: P.anio, tipo: P.tipo, dia: g.day, resultados: P.resultados.map(r => ({ ...r })) });
  g.elecciones.historial.length = Math.min(g.elecciones.historial.length, 6);
  aviso(g, `Elecciones ${P.anio}`, texto, partes.length ? gano : null);
  // Consecuencias en el partido
  if (g.modo === 'fundador' && partes.length) {
    const d = gano ? K(g).efectos.lealtadGana : K(g).efectos.lealtadPierde;
    for (const m of g.plantel.miembros) m.lealtad = clamp(m.lealtad + d, 0, 100);
    g.note(gano ? 'El resultado levantó la moral del partido: sube la lealtad de tus cuadros.' : 'Sin bancas: cae la moral y la lealtad de tus cuadros.', gano ? 'ok' : 'bad');
  }
}

function asumir(g, P) {
  const mia = claveMia(g), E = g.elecciones;
  for (const r of P.resultados) {
    const c = contiendaDef(g, r.contienda), st = P.contiendas[r.contienda], n = r.bancas[mia] ?? 0;
    if (!n) continue;
    // Quiénes ocupan las bancas: tu lista (fundador) o el partido, con vos si conseguiste lugar
    const quienes = [];
    const cupoC = g.modo === 'fundador' ? P.cupos?.[r.contienda] : null;
    if (cupoC) for (const id of cupoC.lista.slice(0, n)) quienes.push(id);
    else if (g.modo === 'fundador') { for (const id of st.lista.slice(0, n)) quienes.push(id); while (quienes.length < n) quienes.push('partido'); }
    else { const lugar = st.lugar; for (let i = 1; i <= n; i++) quienes.push(lugar === i ? 'yo' : 'partido'); }
    for (const q of quienes) {
      if (g.modo !== 'fundador' && q !== 'yo') continue;                  // en un partido existente solo registrás tus propios cargos
      const m = q !== 'yo' && q !== 'partido' ? g.plantel.miembros.find(x => x.id === q) : null;
      E.cargos.push({ id: `c${E.sig++}`, contienda: c.id, cargo: c.cargo, quien: q === 'partido' || (q !== 'yo' && !m) ? 'partido' : q, nombre: q === 'yo' ? g.jugador.nombre : m?.nombre ?? 'Cuadro del partido', desde: g.day, hasta: g.day + K(g).mandatoDias, ...(cupoC ? { bloque: cupoC.host } : {}) });
    }
    const mios = quienes.includes('yo');
    if (cupoC && quienes.length) g.note(`Tus ${quienes.length} electo${quienes.length === 1 ? '' : 's'} forman un bloque con ${nombrePartido(g, cupoC.host)}: podés romperlo cuando quieras.`, 'linea');
    g.note(`Asumieron ${n} ${c.cargo.toLowerCase()}${n === 1 ? '' : 's'} de ${g.partido.nombre}${mios ? ': vos entre ellos' : ''}.`, 'ok');
    if (c.sistema === 'unipersonal') g.note(`${c.titulo}: gobierna tu partido.`, 'promo');
  }
  E.participaciones++;
  E.cargos = E.cargos.filter(c => c.hasta >= g.day).slice(-80);
}

// ---------- Acciones del jugador ----------
const fase = g => g.elecciones.proceso?.fase ?? 'espera';
const cont = (g, cid) => g.elecciones.proceso?.contiendas[cid] ?? null;

export function candidatos(g, cid) {
  const c = contiendaDef(g, cid), out = g.plantel.miembros.map(m => ({ id: m.id, nombre: m.nombre, capacidad: m.capacidad }));
  if (c && g.player.rank >= c.requiere.rangoCandidato) out.unshift({ id: 'yo', nombre: `${g.jugador.nombre} (vos)`, capacidad: 100 });
  return out;
}
export function alternarCandidato(g, cid, qid) {
  const st = cont(g, cid), c = contiendaDef(g, cid);
  if (!st || fase(g) !== 'listas' || g.modo !== 'fundador') return 'Ahora no se pueden armar listas.';
  if (st.estado === 'presentada') return 'La lista ya fue presentada.';
  if (!candidatos(g, cid).some(x => x.id === qid)) return 'Esa persona no puede ser candidata.';
  const i = st.lista.indexOf(qid);
  if (i >= 0) st.lista.splice(i, 1);
  else { if (st.lista.length >= (c.sistema === 'unipersonal' ? 1 : Math.max(1, st.bancas * 2))) return 'La lista ya está completa.'; st.lista.push(qid); }
  return null;
}
export function armarLista(g, cid) {
  const st = cont(g, cid), c = contiendaDef(g, cid);
  if (!st || fase(g) !== 'listas' || g.modo !== 'fundador') return 'Ahora no se pueden armar listas.';
  if (st.estado === 'presentada') return 'La lista ya fue presentada.';
  const n = c.sistema === 'unipersonal' ? 1 : Math.max(1, Math.min(st.bancas, g.plantel.miembros.length + 1));
  st.lista = candidatos(g, cid).sort((a, b) => (b.id === 'yo' ? 1 : 0) - (a.id === 'yo' ? 1 : 0) || b.capacidad - a.capacidad).slice(0, n).map(x => x.id);
  return st.lista.length ? null : 'No tenés a nadie para la lista.';
}
export function presentarLista(g, cid) {
  const st = cont(g, cid), c = contiendaDef(g, cid);
  if (!st || fase(g) !== 'listas') return 'No es momento de presentar listas.';
  if (g.modo !== 'fundador') return 'Tu partido presenta las listas.';
  if (!puedePresentar(g, c)) return `Tu partido todavía no tiene reconocimiento de ${c.requiere.alcance} para presentarse.`;
  if (st.estado === 'presentada') return 'Ya presentaste esta lista.';
  if (g.elecciones.proceso.cupos[cid]) return 'Ya tenés un cupo en la lista de otro partido para esta elección.';
  if (!st.lista.length) return 'Armá la lista primero.';
  const costo = costoLista(g, c);
  if (costo > 0 && g.player.money < costo) return 'Falta dinero para la campaña de esta lista.';
  g.player.money -= costo; st.estado = 'presentada';
  g.note(`Presentaste tu lista para ${c.cargo.toLowerCase()} (${st.lista.length} candidato${st.lista.length === 1 ? '' : 's'}). Costo ${costo ? '$' + costo.toLocaleString('es-AR') : 'sin costo'}.`, 'ok');
  return null;
}
export function retirarLista(g, cid) {
  const st = cont(g, cid), c = contiendaDef(g, cid);
  if (!st || fase(g) !== 'listas' || st.estado !== 'presentada') return 'No hay lista para retirar.';
  g.player.money += Math.round(costoLista(g, c) * 0.5); st.estado = 'abierta';
  return null;
}
// Afiliado: pedir un lugar en la lista del partido. Devuelve null o el motivo.
export function probLugar(g, cid) {
  const c = contiendaDef(g, cid), L = K(g).lugar, rel = g.linea?.lider?.relacion ?? 50;
  return clamp(L.base + L.porRango * (g.player.rank - c.requiere.rangoCandidato) + L.porRelacion * rel, 0.05, 0.9);
}
export function pedirLugar(g, cid, rnd = Math.random) {
  const st = cont(g, cid), c = contiendaDef(g, cid);
  if (!st || fase(g) !== 'listas' || g.modo !== 'afiliado') return 'Ahora no podés pedir un lugar.';
  if (g.player.rank < c.requiere.rangoCandidato) return `Necesitás ser ${g.rangos[c.requiere.rangoCandidato]} para postularte.`;
  if (st.lugar !== null && st.lugar !== undefined) return 'Ya tenés un lugar en esta lista.';
  if (st.pidio) return 'Ya lo pediste: el partido ya decidió.';
  st.pidio = true;
  const p = probLugar(g, cid);
  if (rnd() < p) { st.lugar = 1 + Math.floor((1 - p) * st.bancas * 0.4); g.note(`Tu partido te dio el lugar ${st.lugar} en la lista de ${c.cargo.toLowerCase()}s.`, 'ok'); }
  else g.note(`Tu partido no te dio lugar en la lista de ${c.cargo.toLowerCase()}s esta vez.`, 'bad');
  return null;
}
export function proponerFrente(g, rid, rnd = Math.random) {
  const P = g.elecciones.proceso;
  if (!P || fase(g) !== 'alianzas') return 'Los frentes se arman en la etapa de alianzas.';
  if (g.modo !== 'fundador') return 'Tu partido decide sus alianzas.';
  if (P.frentes.length >= K(g).frente.max) return 'Ya tenés un frente.';
  if (!rivales(g).some(r => r.id === rid)) return 'Ese partido no existe.';
  const rel = relacion(g, rid);
  if (rel < K(g).frente.relacionMin) return `Su relación con vos es ${Math.round(rel)}: hace falta ${K(g).frente.relacionMin} para armar un frente.`;
  const bonus = K(g).frente.famaPorPunto * (g.org?.fama ?? 0) + (g.org?.contactos?.some(c => c.partido === rid) ? K(g).frente.contacto : 0);   // tu fama y tus contactos abren puertas
  if (rnd() < clamp(0.2 + (rel - 50) / 60 + bonus, 0.1, 0.9)) { P.frentes.push({ rival: rid }); g.note(`Armaste un frente electoral con ${nombrePartido(g, rid)}.`, 'ok'); return null; }
  return `${nombrePartido(g, rid)} rechazó el frente.`;
}
export function encargarEncuesta(g) {
  const P = g.elecciones.proceso, E = K(g).encuesta;
  if (!P || !['campana', 'veda', 'listas', 'paso', 'alianzas'].includes(P.fase)) return 'Las encuestas se encargan cuando ya hay campaña en marcha.';
  const costo = costoEncuesta(g);
  if (g.player.money < costo) return 'Falta dinero para encargar la encuesta.';
  const cid = Object.keys(P.contiendas)[0]; if (!cid) return 'No hay elecciones en las que medir.';
  const r = proyectar(g, P, cid, E.margen);
  g.player.money -= costo;
  P.encuestas.push({ dia: g.day, contienda: cid, pct: redondear(r.pct), margen: E.margen, origen: 'Encuesta' });
  if (P.encuestas.length > E.max) P.encuestas.shift();
  g.note('Recibiste los resultados de la encuesta.', 'info');
  return null;
}

// ---------- Cupos en listas ajenas y bloques ----------
export const cupoElegible = (g, c) => !!c.cupo && c.sistema === 'dhondt';
export const maxLugares = (g, c) => Math.max(1, Math.min(K(g).cupo.maxLugares, Math.floor(bancasEnJuego(g, c, g.elecciones.proceso?.anio ?? 2025) * 0.25)));
export function costoCupo(g, lugares) { return escalaMonto(g, K(g).cupo.costoDinero * lugares); }
// Probabilidad de que el socio acepte darte lugares (según relación, fama, contactos, estructura y lo que ofrezcas)
export function probCupo(g, host, lugares, pago) {
  const C = K(g).cupo, rel = relacion(g, host), contacto = g.org?.contactos?.some(c => c.partido === host) ? C.contacto : 0;
  const estruct = ['idea', 'agrupacion'].includes(g.org?.estado) ? 0 : C.estructura;
  return clamp(C.base + C.porRelacion * (rel - 40) + C.porFama * (g.org?.fama ?? 0) + contacto + estruct + C.pago[pago] + C.porLugar * (lugares - 1), 0.05, 0.85);
}
export function proponerCupo(g, cid, host, lugares, pago, rnd = Math.random) {
  const P = g.elecciones.proceso, c = contiendaDef(g, cid);
  if (!P || !c || !P.contiendas[cid]) return 'Esa elección no está en juego.';
  if (g.modo !== 'fundador') return 'Tu partido decide sus listas.';
  if (!['alianzas', 'listas'].includes(P.fase)) return 'Los cupos se negocian entre la etapa de alianzas y el cierre de listas.';
  if (!cupoElegible(g, c)) return 'En ese cargo no se negocian cupos.';
  if (P.cupos[cid]) return 'Ya tenés un cupo para este cargo.';
  if (P.contiendas[cid].estado === 'presentada') return 'Ya presentaste lista propia para este cargo.';
  if (!rivales(g).some(r => r.id === host)) return 'Ese partido no existe.';
  if (P.cupoIntentos[host]) return `${nombrePartido(g, host)} ya te respondió en esta elección.`;
  if (Object.keys(P.cupoIntentos).length >= K(g).cupo.maxIntentos) return 'Ya no te quedan negociaciones para esta elección.';
  const L = clamp(Math.round(lugares), 1, maxLugares(g, c));
  if (!K(g).cupo.pago[pago]) return 'Elegí qué ofrecés a cambio.';
  const costo = pago === 'dinero' ? costoCupo(g, L) : 0;
  if (costo > g.player.money) return 'Falta dinero para ese ofrecimiento.';
  P.cupoIntentos[host] = true;
  const prob = probCupo(g, host, L, pago);
  if (rnd() < prob) {
    g.player.money -= costo;
    const C = K(g).cupo, desp = Math.round((1 - prob) * C.desplazamiento);   // con poco peso te dan lugares peores en la lista
    P.cupos[cid] = { host, lugares: L, pago, lista: [], posiciones: C.posiciones.slice(0, L).map(x => x + desp) };
    cambiarRelacion(g, host, K(g).cupo.relacionGana);
    g.note(`${nombrePartido(g, host)} te dio ${L} lugar${L === 1 ? '' : 'es'} en su lista de ${c.titulo.toLowerCase()}. Elegí a tus candidatos.`, 'ok');
    return null;
  }
  cambiarRelacion(g, host, -3);
  return `${nombrePartido(g, host)} rechazó darte lugares.`;
}
export function armarCupo(g, cid) {
  const P = g.elecciones.proceso, cu = P?.cupos[cid];
  if (!cu) return 'No hay cupo para armar.';
  const cand = candidatos(g, cid).sort((a, b) => (b.id === 'yo') - (a.id === 'yo') || b.capacidad - a.capacidad);
  cu.lista = cand.slice(0, cu.lugares).map(x => x.id);
  return cu.lista.length ? null : 'No tenés a nadie para ocupar el cupo.';
}
export function alternarCupo(g, cid, qid) {
  const cu = g.elecciones.proceso?.cupos[cid];
  if (!cu || !['alianzas', 'listas'].includes(fase(g))) return 'Ahora no podés cambiar el cupo.';
  if (!candidatos(g, cid).some(x => x.id === qid)) return 'Esa persona no puede ser candidata.';
  const i = cu.lista.indexOf(qid);
  if (i >= 0) cu.lista.splice(i, 1); else if (cu.lista.length >= cu.lugares) return 'Ya ocupaste todos los lugares del cupo.'; else cu.lista.push(qid);
  return null;
}
// Bloques: tus electos por cupo responden al socio hasta que rompés
export const bloques = g => { const out = {}; for (const c of cargosVigentes(g)) if (c.bloque) (out[c.bloque] ??= []).push(c); return out; };
export function romperBloque(g, host) {
  const L = bloques(g)[host]; if (!L?.length) return 'No tenés un bloque con ese partido.';
  const R = K(g).cupo.ruptura;
  for (const c of L) delete c.bloque;
  cambiarRelacion(g, host, R.host);
  for (const r of rivales(g)) if (r.id !== host) cambiarRelacion(g, r.id, R.otros);
  if (g.org) g.org.fama = clamp(g.org.fama + R.fama, 0, 100);
  g.note(`Rompiste el bloque con ${nombrePartido(g, host)}: te quedás con tus ${L.length} electo${L.length === 1 ? '' : 's'}, pero ganaste un enemigo y perdiste confianza entre los demás partidos.`, 'bad');
  return null;
}

// ---------- Ganchos del juego ----------
export function alResolver(g, job, ok) {
  const P = g.elecciones?.proceso, m = g.mission(job.mission);
  if (!P || !ok || !['campana', 'veda'].includes(P.fase) || m?.categoria === 'finanzas') return;
  P.campana[job.zone] = clamp((P.campana[job.zone] ?? 0) + K(g).modelo.campanaPorMision, 0, K(g).modelo.campanaMax);
}
// Un miembro con banca se va: se la lleva
export function alBajar(g, m) {
  const E = g.elecciones; if (!E || !g.cfg.elecciones) return;
  const i = E.cargos.findIndex(c => c.quien === m.id && c.hasta >= g.day);
  if (i >= 0) { const c = E.cargos[i]; E.cargos.splice(i, 1); g.note(`${m.nombre} se llevó su banca de ${c.cargo.toLowerCase()}: tu partido pierde ese lugar.`, 'bad'); }
}

// ---------- Turno diario ----------
export function tick(g) {
  const E = g.elecciones; if (!E || !g.cfg.elecciones) return;
  E.alcance = alcanceDe(g); E.bancas = bancasDe(g);
  if (E.cargos.length) E.cargos = E.cargos.filter(c => c.hasta >= g.day);
  // clima de opinión: camina cada quincena y vuelve hacia 0
  if (g.day % 15 === 0) {
    const r = rng(`${g.prov.id}:${g.day}:clima`), M = K(g).modelo;
    for (const id of [...rivales(g).map(x => x.id), claveMia(g)]) { const prev = E.clima[id] ?? 0; E.clima[id] = clamp(prev * 0.85 + (r() * 2 - 1) * M.climaSigma * 1.7, -M.climaMax, M.climaMax); }
  }
  const anio = anioProximo(g.cfg, g.day);
  if (!E.proceso || E.proceso.anio !== anio) E.proceso = nuevoProceso(g, anio);
  const P = E.proceso, objetivo = faseObjetivo(g, P);
  if (P.balotaje && !P.balotaje.hecho && g.day >= P.fechas.balotaje && g.day < P.fechas.asuncion) resolverBalotaje(g, P);
  if (objetivo !== P.fase) {
    // Entra en todas las fases intermedias que se hayan salteado (p. ej. al cargar una partida)
    for (let i = FASES.indexOf(P.fase) + 1; i <= FASES.indexOf(objetivo); i++) { P.fase = FASES[i]; entrar(g, P, FASES[i]); if (!E.proceso) return; }
  }
}

// ---------- Restauración segura ----------
export function sanear(g, raw) {
  const base = iniciar();
  if (!g.cfg.elecciones || !raw || typeof raw !== 'object') return base;
  const ids = new Set([...g.cfg.partidos.partidos.map(p => p.id), 'yo', 'otros']);
  const cids = new Set(K(g).contiendas.map(c => c.id));
  const num = (v, a, b, d = 0) => (fin(v) ? clamp(v, a, b) : d);
  const pctMap = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => ids.has(k) && fin(v)).map(([k, v]) => [k, clamp(v, 0, 1)]));
  const intMap = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => ids.has(k) && fin(v)).map(([k, v]) => [k, clamp(Math.round(v), 0, 99)]));
  const out = { ...base, sig: num(raw.sig, 1, 1e6, 1), participaciones: num(Math.floor(raw.participaciones), 0, 99, 0) };
  if (raw.clima && typeof raw.clima === 'object') for (const [k, v] of Object.entries(raw.clima)) if (ids.has(k) && fin(v)) out.clima[k] = clamp(v, -0.3, 0.3);
  if (Array.isArray(raw.cargos)) out.cargos = raw.cargos.filter(c => c && cids.has(c.contienda) && fin(c.desde) && fin(c.hasta)).slice(-80).map(c => ({
    id: String(c.id ?? '').replace(/[^\w-]/g, '').slice(0, 20) || `c${out.sig++}`, contienda: c.contienda, cargo: String(c.cargo ?? '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 30),
    bloque: ids.has(c.bloque) && c.bloque !== 'yo' ? c.bloque : undefined, quien: c.quien === 'yo' ? 'yo' : c.quien === 'partido' ? 'partido' : String(c.quien ?? 'partido').replace(/[^\w:-]/g, '').slice(0, 40), nombre: String(c.nombre ?? '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) || 'Cuadro del partido', desde: c.desde, hasta: c.hasta }));
  if (Array.isArray(raw.historial)) out.historial = raw.historial.filter(h => h && fin(h.anio) && Array.isArray(h.resultados)).slice(0, 6).map(h => ({
    anio: Math.floor(h.anio), tipo: h.tipo === 'ejecutiva' ? 'ejecutiva' : 'legislativa', dia: num(h.dia, 0, 1e6),
    resultados: h.resultados.filter(r => r && cids.has(r.contienda)).slice(0, 12).map(r => ({ contienda: r.contienda, pct: pctMap(r.pct), bancas: intMap(r.bancas), ganador: ids.has(r.ganador) ? r.ganador : null, participacion: num(r.participacion, 0, 1), frente: ids.has(r.frente) ? r.frente : null, cupo: r.cupo && ids.has(r.cupo.host) && fin(r.cupo.m) ? { host: r.cupo.host, m: clamp(Math.floor(r.cupo.m), 0, 9) } : null })) }));
  const p = raw.proceso;
  if (p && typeof p === 'object' && fin(p.anio) && p.anio >= 2025 && FASES.includes(p.fase)) {
    const np = nuevoProceso(g, Math.floor(p.anio));
    np.fase = p.fase;
    for (const [cid, st] of Object.entries(np.contiendas)) {
      const r = p.contiendas?.[cid]; if (!r) continue;
      st.estado = ['abierta', 'presentada', 'no_presenta'].includes(r.estado) ? r.estado : 'abierta';
      st.lista = Array.isArray(r.lista) ? r.lista.filter(x => typeof x === 'string').map(x => x.replace(/[^\w:-]/g, '').slice(0, 40)).slice(0, 60) : [];
      st.lugar = fin(r.lugar) ? clamp(Math.floor(r.lugar), 1, 99) : null; if (r.pidio) st.pidio = true;
    }
    if (p.balotaje && cids.has(p.balotaje.contienda) && Array.isArray(p.balotaje.finalistas) && p.balotaje.finalistas.length === 2 && p.balotaje.finalistas.every(x => ids.has(x))) np.balotaje = { contienda: p.balotaje.contienda, finalistas: [...p.balotaje.finalistas], hecho: !!p.balotaje.hecho };
    if (p.cupos && typeof p.cupos === 'object') for (const [cid, cu] of Object.entries(p.cupos)) if (cids.has(cid) && cu && ids.has(cu.host) && cu.host !== 'yo' && fin(cu.lugares)) np.cupos[cid] = { host: cu.host, lugares: clamp(Math.floor(cu.lugares), 1, 5), posiciones: Array.isArray(cu.posiciones) ? cu.posiciones.filter(fin).map(x => clamp(Math.floor(x), 1, 40)).slice(0, 5) : undefined, pago: K(g).cupo.pago[cu.pago] ? cu.pago : 'apoyo', lista: Array.isArray(cu.lista) ? cu.lista.filter(x => typeof x === 'string').map(x => x.replace(/[^\w:-]/g, '').slice(0, 40)).slice(0, 5) : [] };
    if (p.cupoIntentos && typeof p.cupoIntentos === 'object') for (const [h, v] of Object.entries(p.cupoIntentos)) if (ids.has(h) && v) np.cupoIntentos[h] = true;
    np.frentes = Array.isArray(p.frentes) ? p.frentes.filter(f => f && ids.has(f.rival) && f.rival !== 'yo').slice(0, 1).map(f => ({ rival: f.rival })) : [];
    np.encuestas = Array.isArray(p.encuestas) ? p.encuestas.filter(e => e && cids.has(e.contienda) && fin(e.dia)).slice(-5).map(e => ({ dia: e.dia, contienda: e.contienda, pct: pctMap(e.pct), margen: num(e.margen, 0, 0.5, 0.03), origen: e.origen === 'PASO' ? 'PASO' : 'Encuesta' })) : [];
    if (p.campana && typeof p.campana === 'object') for (const [z, v] of Object.entries(p.campana)) if (g.zonas[z] && fin(v)) np.campana[z] = clamp(v, 0, K(g).modelo.campanaMax);
    if (Array.isArray(p.resultados)) np.resultados = p.resultados.filter(r => r && cids.has(r.contienda)).map(r => ({ contienda: r.contienda, pct: pctMap(r.pct), bancas: intMap(r.bancas), ganador: ids.has(r.ganador) ? r.ganador : null, participacion: num(r.participacion, 0, 1), frente: ids.has(r.frente) ? r.frente : null, cupo: r.cupo && ids.has(r.cupo.host) && fin(r.cupo.m) ? { host: r.cupo.host, m: clamp(Math.floor(r.cupo.m), 0, 9) } : null }));
    out.proceso = np;
  }
  return out;
}
