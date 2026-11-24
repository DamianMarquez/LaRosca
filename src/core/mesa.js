// Mesa de armado de listas y alianzas: ofertas por rondas entre la etapa de alianzas y el cierre de listas. Sin DOM.
// Al cerrarse un trato se escribe en P.frentes / P.cupos, así el motor de votos no cambia.
import { rng } from './city.js';
import { rivales } from './rivals.js';
import { relacion, cambiarRelacion } from './pactos.js';
import { rencor } from './ofensivas.js';
import * as el from './elecciones.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const M = g => g.cfg.elecciones.mesa;
const P_ = g => g.elecciones?.proceso ?? null;
export const abierta = g => !!P_(g) && ['alianzas', 'listas'].includes(P_(g).fase) && g.modo === 'fundador';
export const estado = g => (P_(g).mesa ??= { props: [], sig: 1, bots: null, avisoCierre: false });
export const TIPOS = { frente: 'Frente electoral', cupo: 'Cupo en su lista', apoyo: 'Apoyo electoral' };
const nombre = (g, id) => el.nombrePartido(g, id);
const ACTIVA = ['pendiente', 'contraoferta'];

// ---------- Consultas ----------
export const propuestas = g => (P_(g) ? estado(g).props : []);
export const deRival = (g, rid) => propuestas(g).filter(p => p.rid === rid);
export const activas = g => propuestas(g).filter(p => ACTIVA.includes(p.estado));
export const acordadas = g => propuestas(g).filter(p => p.estado === 'aceptada');
export const aliadoDeOtro = (g, rid) => { const b = estado(g).bots ?? []; const x = b.find(f => f.a === rid || f.b === rid); return x ? (x.a === rid ? x.b : x.a) : null; };
export const botsFrentes = g => estado(g).bots ?? [];
export const diasAlCierre = g => el.diasParaCierre(g);

// Resumen visible por partido
export function estadoDe(g, rid) {
  const l = deRival(g, rid), ult = l[l.length - 1];
  if (aliadoDeOtro(g, rid)) return { id: 'otro', texto: `aliado de ${nombre(g, aliadoDeOtro(g, rid))}` };
  if (!ult) return { id: 'libre', texto: 'sin contacto' };
  const t = { pendiente: 'esperando respuesta', contraoferta: 'te hizo una contraoferta', aceptada: 'acordado', rechazada: 'rechazó', vencida: 'sin respuesta', rota: 'se rompió el acuerdo', retirada: 'retiraste la oferta' }[ult.estado];
  return { id: ult.estado, texto: t };
}

// Probabilidad de que acepte (0..1) para los términos t
export function prob(g, rid, t) {
  const C = M(g), rel = relacion(g, rid), fama = g.org?.fama ?? 0, rc = rencor(g, rid) * C.penalRencor;
  const contacto = g.org?.contactos?.some(c => c.partido === rid);
  if (t.tipo === 'cupo') return clamp(el.probCupo(g, rid, t.lugares, t.pago) - rc, 0.03, 0.85);
  if (t.tipo === 'frente') { const F = C.frente; return clamp(F.base + F.porRelacion * (rel - 50) + F.porFama * fama + (contacto ? F.contacto : 0) + (t.cabeza === 'socio' ? F.cedeCabeza : 0) + (t.dinero ? F.dinero : 0) - rc, 0.03, 0.9); }
  const A = C.apoyo; return clamp(A.base + A.porRelacion * (rel - 40) + (contacto ? 0.08 : 0) - rc, 0.05, 0.9);
}
export const costoDinero = (g, t) => t.tipo === 'cupo' ? (t.pago === 'dinero' ? el.costoCupo(g, t.lugares) : 0) : t.dinero ? el.costoCupo(g, 1) : 0;

export function motivo(g, rid, t) {
  const P = P_(g); if (!P || !abierta(g)) return 'La mesa está abierta entre las alianzas y el cierre de listas.';
  if (!rivales(g).some(r => r.id === rid)) return 'Ese partido no existe.';
  if (aliadoDeOtro(g, rid)) return `${nombre(g, rid)} ya es aliado de ${nombre(g, aliadoDeOtro(g, rid))}.`;
  if (activas(g).length >= M(g).maxActivas) return `Ya tenés ${M(g).maxActivas} negociaciones abiertas.`;
  const prev = deRival(g, rid);
  if (prev.some(p => ACTIVA.includes(p.estado) || p.estado === 'aceptada')) return `Ya estás negociando o tenés un acuerdo con ${nombre(g, rid)}.`;
  if (prev.length >= M(g).maxRondas + 1) return `${nombre(g, rid)} ya no quiere seguir negociando.`;
  if (t.tipo === 'frente') {
    if (P.frentes.length) return 'Ya tenés un frente.';
    if (relacion(g, rid) < M(g).frente.relacionMin) return `Su relación con vos es ${Math.round(relacion(g, rid))}: hace falta ${M(g).frente.relacionMin}.`;
  } else if (t.tipo === 'cupo') {
    const c = el.contiendaDef(g, t.cid);
    if (!c || !P.contiendas[t.cid] || !el.cupoElegible(g, c)) return 'En ese cargo no se negocian cupos.';
    if (P.cupos[t.cid]) return 'Ya tenés un cupo para ese cargo.';
    if (P.contiendas[t.cid].estado === 'presentada') return 'Ya presentaste lista propia para ese cargo.';
    if (!g.cfg.elecciones.cupo.pago[t.pago]) return 'Elegí qué ofrecés a cambio.';
    if (propuestas(g).some(p => p.tipo === 'cupo' && p.cid === t.cid && ACTIVA.includes(p.estado))) return 'Ya hay una negociación abierta por ese cargo.';
  } else if (t.tipo !== 'apoyo') return 'Tipo de acuerdo inválido.';
  if (costoDinero(g, t) > g.player.money) return 'Falta dinero para ese ofrecimiento.';
  return null;
}

// ---------- Acciones del jugador ----------
export function ofrecer(g, rid, t, rnd = Math.random) {
  const tt = { tipo: t.tipo, cid: t.cid ?? null, lugares: t.tipo === 'cupo' && el.contiendaDef(g, t.cid) ? clamp(Math.round(t.lugares ?? 1), 1, el.maxLugares(g, el.contiendaDef(g, t.cid))) : 0, pago: t.tipo === 'cupo' ? t.pago : null, cabeza: t.tipo === 'frente' ? (t.cabeza === 'socio' ? 'socio' : 'yo') : null, dinero: !!t.dinero && t.tipo === 'frente' };
  const m = motivo(g, rid, tt); if (m) return m;
  const [a, b] = M(g).respuesta, P = estado(g), dias = a + Math.floor(rnd() * (b - a + 1));
  P.props.push({ id: P.sig++, rid, ...tt, estado: 'pendiente', ronda: 1, desde: g.day, responde: g.day + dias, vence: null, contra: null, nota: '' });
  g.note(`Mesa: le ofreciste a ${nombre(g, rid)} ${descripcion(g, P.props[P.props.length - 1])}. Responde en ${dias} días.`, 'info');
  return null;
}
export function retirar(g, id) {
  const p = propuestas(g).find(x => x.id === id); if (!p || !ACTIVA.includes(p.estado)) return 'No hay nada para retirar.';
  p.estado = 'retirada'; g.note(`Mesa: retiraste tu oferta a ${nombre(g, p.rid)}.`, 'info'); return null;
}
export function responder(g, id, acepta) {
  const p = propuestas(g).find(x => x.id === id); if (!p || p.estado !== 'contraoferta') return 'Esa contraoferta ya no está vigente.';
  if (!acepta) { p.estado = 'rechazada'; p.nota = 'rechazaste su contraoferta'; g.note(`Mesa: rechazaste la contraoferta de ${nombre(g, p.rid)}.`, 'info'); return null; }
  const t = { ...p, ...p.contra }; const err = costoDinero(g, t) > g.player.money ? 'Falta dinero para aceptar la contraoferta.' : cerrar(g, p, t, true);
  return err;
}

export function descripcion(g, p) {
  const t = { ...p };
  if (p.tipo === 'frente') return `un frente electoral${p.cabeza === 'socio' ? ' cediéndole la cabeza de lista' : ''}${p.dinero ? ' con aporte de dinero' : ''}`;
  if (p.tipo === 'cupo') return `${p.lugares} lugar${p.lugares === 1 ? '' : 'es'} en su lista de ${(el.contiendaDef(g, p.cid)?.titulo ?? p.cid).toLowerCase()} a cambio de ${p.pago === 'dinero' ? 'dinero' : p.pago === 'bloque' ? 'formar bloque' : 'apoyo'}`;
  return 'un apoyo electoral mutuo';
}
export function textoContra(g, p) {
  const c = p.contra; if (!c) return '';
  const partes = []; if (c.lugares && c.lugares !== p.lugares) partes.push(`${c.lugares} lugar${c.lugares === 1 ? '' : 'es'} en vez de ${p.lugares}`);
  if (c.cabeza === 'socio' && p.cabeza !== 'socio') partes.push('que ellos encabecen');
  if (c.dinero) partes.push(`un aporte de ${'$' + Math.round(c.dinero).toLocaleString('es-AR')}`);
  return partes.join(' y ') || 'mejores condiciones';
}

// ---------- Cierre de un trato ----------
function cerrar(g, p, t, esContra = false) {
  const P = P_(g), C = M(g);
  const costo = (t.tipo === 'cupo' ? (t.pago === 'dinero' ? el.costoCupo(g, t.lugares) : 0) : t.dinero ? el.costoCupo(g, 1) : 0) + (esContra ? (p.contra?.dinero ?? 0) : 0);
  if (costo > g.player.money) { p.estado = 'rechazada'; p.nota = 'no tenías fondos'; return 'Falta dinero para cerrar el acuerdo.'; }
  if (t.tipo === 'frente' && P.frentes.length) { p.estado = 'rechazada'; return 'Ya tenés un frente.'; }
  if (t.tipo === 'cupo' && P.cupos[t.cid]) { p.estado = 'rechazada'; return 'Ya tenés un cupo para ese cargo.'; }
  g.player.money -= costo; p.pagado = costo;
  p.estado = 'aceptada'; p.cerro = g.day;
  Object.assign(p, { lugares: t.lugares ?? p.lugares, cabeza: t.cabeza ?? p.cabeza });
  if (p.tipo === 'frente') P.frentes.push({ rival: p.rid });
  else if (p.tipo === 'cupo') { const E = g.cfg.elecciones.cupo, desp = Math.round((1 - prob(g, p.rid, p)) * E.desplazamiento); P.cupos[p.cid] = { host: p.rid, lugares: p.lugares, pago: p.pago, lista: [], posiciones: E.posiciones.slice(0, p.lugares).map(x => x + desp) }; P.cupoIntentos[p.rid] = true; cambiarRelacion(g, p.rid, E.relacionGana); }
  else { cambiarRelacion(g, p.rid, C.apoyo.relacionGana); for (const z of Object.values(g.zonas)) if ((el.presenciaDe?.(g, z.id, p.rid) ?? 0) > 0.1) P.campana[z.id] = clamp((P.campana[z.id] ?? 0) + C.apoyo.campana, 0, g.cfg.elecciones.modelo.campanaMax); }
  g.note(`Mesa: ${nombre(g, p.rid)} aceptó ${descripcion(g, p)}.`, 'ok');
  g.informar({ tipo: 'eleccion', nombre: 'Mesa de armado', zona: null, zonaNombre: '', ok: true, texto: `${nombre(g, p.rid)} aceptó ${descripcion(g, p)}. Puede romperse hasta el cierre de listas.`, cambios: [] });
  return null;
}

// ---------- Respuesta del socio ----------
function evaluar(g, p, rnd) {
  const C = M(g), pr = prob(g, p.rid, p), r = rnd();
  if (r < pr) { cerrar(g, p, p); return; }
  if (p.ronda < C.maxRondas && r < pr + C.contraProb && p.tipo !== 'apoyo') {
    const contra = {};
    if (p.tipo === 'cupo') { if (p.lugares > 1) contra.lugares = p.lugares - 1; contra.dinero = Math.round(el.costoCupo(g, p.lugares) * C.contra.dineroPorLugar); }
    else { if (p.cabeza !== 'socio') contra.cabeza = 'socio'; contra.dinero = C.contra.dineroFrente; }
    p.estado = 'contraoferta'; p.contra = contra; p.ronda++; p.vence = g.day + C.contraVence;
    g.note(`Mesa: ${nombre(g, p.rid)} te hizo una contraoferta: pide ${textoContra(g, p)}. Tenés ${C.contraVence} días.`, 'info');
    g.informar({ tipo: 'eleccion', nombre: 'Mesa de armado', zona: null, zonaNombre: '', ok: null, texto: `${nombre(g, p.rid)} te hizo una contraoferta: pide ${textoContra(g, p)}. Respondé en Elecciones → Mesa antes de ${C.contraVence} días.`, cambios: [] });
    return;
  }
  p.estado = 'rechazada'; cambiarRelacion(g, p.rid, -3);
  g.note(`Mesa: ${nombre(g, p.rid)} rechazó ${descripcion(g, p)}.`, 'bad');
}

// ---------- Rivales entre sí ----------
function formarBots(g, P) {
  const C = M(g).bots, r = rng(`${g.prov.id}:${P.anio}:mesa`), rs = rivales(g), pares = [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const af = rs[i].principios.filter(x => rs[j].principios.includes(x)).length;
    if (af >= C.afinidadMin) pares.push({ a: rs[i].id, b: rs[j].id, af: af + r() * 0.9 });
  }
  pares.sort((x, y) => y.af - x.af);
  const usados = new Set(), out = [];
  for (const p of pares) { if (out.length >= C.max) break; if (usados.has(p.a) || usados.has(p.b) || r() > C.prob) continue; usados.add(p.a); usados.add(p.b); out.push({ a: p.a, b: p.b }); }
  return out;
}

// ---------- Turno diario ----------
export function tick(g, rnd = Math.random) {
  const P = P_(g); if (!P || g.modo !== 'fundador') return;
  const E = estado(g);
  if (E.bots === null && ['alianzas', 'listas'].includes(P.fase)) {
    E.bots = formarBots(g, P);
    if (E.bots.length) g.note(`Mesa: ${E.bots.map(f => `${nombre(g, f.a)} y ${nombre(g, f.b)}`).join('; ')} ${E.bots.length > 1 ? 'se aliaron' : 'se aliaron'} entre sí.`, 'info');
  }
  if (!['alianzas', 'listas'].includes(P.fase)) { for (const p of E.props) if (ACTIVA.includes(p.estado)) { p.estado = 'vencida'; p.nota = 'cerró la mesa'; } return; }
  for (const p of E.props) {
    if (p.estado === 'pendiente' && g.day >= p.responde) evaluar(g, p, rnd);
    else if (p.estado === 'contraoferta' && g.day >= p.vence) { p.estado = 'vencida'; p.nota = 'no respondiste a tiempo'; g.note(`Mesa: se venció la contraoferta de ${nombre(g, p.rid)}.`, 'bad'); }
    else if (p.estado === 'aceptada') {
      const R = M(g).ruptura, rel = relacion(g, p.rid), h = R.base * (1 + rencor(g, p.rid) * R.porRencor) * (1 + Math.max(0, 50 - rel) * R.porMalaRelacion);
      if (rnd() < h) romper(g, P, p);
    }
  }
  const d = diasAlCierre(g);
  if (P.fase === 'listas' && d !== null && d <= M(g).avisoCierre && d > 0 && !E.avisoCierre && (activas(g).length || acordadas(g).length)) {
    E.avisoCierre = true;
    g.informar({ tipo: 'eleccion', nombre: 'Cierra la mesa', zona: null, zonaNombre: '', ok: null, texto: `Quedan ${d} días para el cierre de listas. Lo que no cierres ahora queda afuera.`, cambios: [] });
  }
}
function romper(g, P, p) {
  const R = M(g).ruptura;
  p.estado = 'rota'; p.nota = 'se rompió antes del cierre';
  if (p.tipo === 'frente') P.frentes = P.frentes.filter(f => f.rival !== p.rid);
  else if (p.tipo === 'cupo') delete P.cupos[p.cid];
  cambiarRelacion(g, p.rid, R.relacion);
  for (const z of Object.values(g.zonas)) z.trust = clamp(z.trust + R.trust, 0, 100);
  g.note(`Mesa: ${nombre(g, p.rid)} rompió ${descripcion(g, p)}. Perdiste el acuerdo y algo de confianza.`, 'bad');
  g.informar({ tipo: 'eleccion', nombre: 'Se rompió un acuerdo', zona: null, zonaNombre: '', ok: false, texto: `${nombre(g, p.rid)} rompió ${descripcion(g, p)} antes del cierre de listas.`, cambios: [] });
}

// ---------- Restauración segura ----------
export function sanear(g, raw) {
  const out = { props: [], sig: 1, bots: null, avisoCierre: false };
  if (!raw || typeof raw !== 'object') return out;
  const ids = new Set(rivales(g).map(r => r.id)), fin = Number.isFinite;
  const ESTADOS = ['pendiente', 'contraoferta', 'aceptada', 'rechazada', 'vencida', 'rota', 'retirada'];
  out.sig = fin(raw.sig) ? clamp(Math.floor(raw.sig), 1, 1e6) : 1; out.avisoCierre = !!raw.avisoCierre;
  if (Array.isArray(raw.bots)) out.bots = raw.bots.filter(f => f && ids.has(f.a) && ids.has(f.b) && f.a !== f.b).slice(0, 3).map(f => ({ a: f.a, b: f.b }));
  if (Array.isArray(raw.props)) for (const p of raw.props.slice(0, 40)) {
    if (!p || !ids.has(p.rid) || !['frente', 'cupo', 'apoyo'].includes(p.tipo) || !ESTADOS.includes(p.estado) || !fin(p.desde) || !fin(p.responde)) continue;
    const c = p.contra && typeof p.contra === 'object' ? { ...(fin(p.contra.lugares) ? { lugares: clamp(Math.floor(p.contra.lugares), 1, 5) } : {}), ...(p.contra.cabeza === 'socio' ? { cabeza: 'socio' } : {}), ...(fin(p.contra.dinero) ? { dinero: clamp(Math.round(p.contra.dinero), 0, 1e7) } : {}) } : null;
    out.props.push({ id: fin(p.id) ? Math.floor(p.id) : out.sig++, rid: p.rid, tipo: p.tipo, cid: typeof p.cid === 'string' ? p.cid.replace(/[^\w-]/g, '').slice(0, 30) : null, lugares: fin(p.lugares) ? clamp(Math.floor(p.lugares), 0, 5) : 0, pago: ['dinero', 'apoyo', 'bloque'].includes(p.pago) ? p.pago : null, cabeza: p.cabeza === 'socio' ? 'socio' : p.cabeza === 'yo' ? 'yo' : null, dinero: !!p.dinero, estado: p.estado, ronda: fin(p.ronda) ? clamp(Math.floor(p.ronda), 1, 5) : 1, desde: p.desde, responde: p.responde, vence: fin(p.vence) ? p.vence : null, contra: c, nota: typeof p.nota === 'string' ? p.nota.replace(/[<>]/g, '').slice(0, 60) : '' });
  }
  return out;
}

el.registrarMesa(sanear);
