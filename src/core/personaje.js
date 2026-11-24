// Personaje: habilidades, familia, trabajo y desgaste. Sin DOM.
// Las habilidades se entrenan haciendo misiones afines (hasta el nivel 3) y mejoran con puntos al ascender (hasta el 5).
import { rng } from './city.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = Number.isFinite;
const H = g => g.cfg.habilidades, V = g => g.cfg.vida;
const limpia = (s, max = 30) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export const limpiarNombrePersona = s => limpia(s, 30);

// ---------- Estado inicial ----------
export function iniciar(g, partido) {
  const fam = V(g).familia.find(f => f.id === partido?.familia) ?? V(g).familia[0];
  const r = rng(`${g.prov.id}:${g.partido.nombre}:jugador`), N = g.cfg.plantel.nombres;
  const generado = `${N.nombre[Math.floor(r() * N.nombre.length)]} ${N.apellido[Math.floor(r() * N.apellido.length)]}`;
  const estilo = V(g).estilos?.find(e => e.id === partido?.estilo)?.id ?? 'equilibrado';
  const tf = g.trasfondo ?? null, ES = V(g).estilos?.find(e => e.id === estilo);
  const base = Object.fromEntries(H(g).ramas.map(x => [x.id, clamp((tf?.habilidades?.[x.id] ?? 0) + libres(g, partido?.puntos)[x.id], 0, H(g).baseMax ?? 3)]));   // profesión + puntos libres
  const famaBase = clamp((tf?.fama ?? 0) + (ES?.famaInicial ?? 0), 0, 100);
  return {
    nombre: limpia(partido?.jugadorNombre) || generado,
    familia: { pareja: fam.pareja, hijos: fam.hijos },
    trabajo: { estado: 'completo', mejora: 0, ultimoCambio: -999 },
    habilidades: Object.fromEntries(H(g).ramas.map(x => [x.id, { xp: 0, invertidos: 0, base: base[x.id] }])),
    estilo, fama: famaBase, famaBase,
    puntos: 0, desgaste: 5, descanso: null, ultimaCrisis: -999,
  };
}

// ---------- Habilidades ----------
export const rama = (g, id) => H(g).ramas.find(x => x.id === id);
function natural(g, id) {
  const xp = g.jugador.habilidades[id]?.xp ?? 0, T = H(g).xpNivel; let n = 0;
  for (let i = 1; i < T.length; i++) if (xp >= T[i]) n = i;
  return n;
}
export const nivel = (g, id) => (g.jugador.habilidades[id] ? Math.min(H(g).maximo, natural(g, id) + g.jugador.habilidades[id].invertidos + (g.jugador.habilidades[id].base ?? 0)) : 0);

// Puntos libres de la creación: {rama: n}, recortados al total permitido y al máximo por rama
export function libres(g, puntos) {
  const out = Object.fromEntries(H(g).ramas.map(x => [x.id, 0]));
  let resto = H(g).puntosCreacion ?? 0;
  if (puntos && typeof puntos === 'object') for (const x of H(g).ramas) { const n = clamp(Math.floor(Number(puntos[x.id]) || 0), 0, Math.min(resto, H(g).baseMax ?? 3)); out[x.id] = n; resto -= n; }
  return out;
}

// ---------- Estilo público y fama ----------
export const estiloDe = g => V(g).estilos?.find(e => e.id === g.jugador.estilo) ?? { famaMult: 1, confianzaMult: 1, afiliacionMult: 1, escandaloMult: 1, rencorMult: 1 };
// Fama del personaje: la del fundador (notoriedad del partido) o la propia si te afiliaste
export const fama = g => (g.org ? g.org.fama : g.jugador.fama);
export function ganarFama(g, n) {
  const E = V(g).efectosFamilia, T = V(g).trabajo.famaMult ?? {};
  const vida = Math.max(0.5, 1 + (g.jugador.familia.pareja ? E.famaPareja ?? 0 : 0) + g.jugador.familia.hijos * (E.famaHijo ?? 0)) * (T[g.jugador.trabajo.estado] ?? 1);   // familia y trabajo condicionan el tiempo para los medios
  const v = n > 0 ? n * estiloDe(g).famaMult * vida : n;
  if (g.org) g.org.fama = clamp(g.org.fama + v, 0, 100); else g.jugador.fama = clamp(g.jugador.fama + v, 0, 100);
  return v;
}
// Avance hacia el próximo nivel natural (null si la práctica ya no da más)
export function progresoNivel(g, id) {
  const T = H(g).xpNivel, n = natural(g, id), xp = g.jugador.habilidades[id].xp;
  if (n >= T.length - 1) return null;
  return { frac: clamp((xp - T[n]) / (T[n + 1] - T[n]), 0, 1), falta: Math.ceil(T[n + 1] - xp) };
}

const ORATORIA = ['volantes', 'pintadas', 'reunion'], CALLE = ['visitas', 'comunidad'];

// Puntos de éxito por habilidades, familia y desgaste (cada uno con su etiqueta, para mostrar en "Por qué X%")
export function factores(g, m, modo = 'personal') {
  const f = [], N = id => nivel(g, id), add = (txt, pts) => { const p = Math.round(pts); if (p) f.push([txt, p]); };
  if (ORATORIA.includes(m.id)) add(`Oratoria (nivel ${N('oratoria')})`, 1.5 * N('oratoria'));
  if (CALLE.includes(m.id)) add(`Calle (nivel ${N('calle')})`, 1.5 * N('calle'));
  if (m.categoria === 'finanzas') add(`Finanzas (nivel ${N('finanzas')})`, N('finanzas'));
  if (modo === 'delegada') add(`Organización (nivel ${N('organizacion')})`, N('organizacion'));
  if (CALLE.includes(m.id)) { const E = V(g).efectosFamilia; add('Imagen de familia', Math.min(3, (g.jugador.familia.pareja ? E.imagenPareja : 0) + g.jugador.familia.hijos * E.imagenHijo)); }
  const D = V(g).desgaste, d = g.jugador.desgaste;
  if (d >= D.critico) f.push(['Agotamiento', D.penalCritico]); else if (d >= D.alto) f.push(['Cansancio', D.penalAlto]);
  return f;
}

// Ventajas y bonos por nivel (los usan los demás módulos)
export const alcanceMult = (g, m) => (nivel(g, 'oratoria') >= 5 && ORATORIA.includes(m.id) ? 1.1 : 1);
export const afiliacionMult = g => (1 + 0.04 * nivel(g, 'organizacion')) * estiloDe(g).afiliacionMult;
export const equipoExtra = g => (nivel(g, 'organizacion') >= 5 ? 1 : 0);
export const desercionMult = g => (nivel(g, 'organizacion') >= 3 ? 0.85 : 1);
export const confianzaMult = (g, m) => (nivel(g, 'calle') >= 3 && CALLE.includes(m.id) ? 1.25 : 1) * estiloDe(g).confianzaMult;
export const erosionMult = g => (nivel(g, 'calle') >= 5 ? 0.7 : 1);
export const recaudacionMult = g => 1 + 0.05 * nivel(g, 'finanzas');
export const gastoFijoMult = g => (nivel(g, 'finanzas') >= 3 ? 0.9 : 1);
export const expoIlegalMult = g => (nivel(g, 'finanzas') >= 5 ? 0.8 : 1);
export const pactoBonus = g => { const n = nivel(g, 'negociacion'); return { aceptacion: 0.04 * n, descuento: 0.05 * n, enfriamiento: n >= 3 ? 5 : 0, traicion: n >= 5 ? 0.5 : 1 }; };

// Entrenamiento por el uso
export function alResolver(g, m, ok) {
  const T = H(g).entrenamiento;
  for (const r of H(g).ramas) {
    if (!r.entrena.includes(m.id)) continue;
    const antes = nivel(g, r.id);
    g.jugador.habilidades[r.id].xp += ok ? T.exito : T.fallo;
    const ahora = nivel(g, r.id);
    if (ahora > antes) g.note(`Tu ${r.nombre} subió a nivel ${ahora}: ${r.ventajas[ahora] ?? r.porNivel}`, 'ok');
  }
}
export function alAscender(g) {
  g.jugador.puntos += H(g).puntosPorAscenso;
  g.note(`Ganaste ${H(g).puntosPorAscenso} puntos de habilidad: gastalos en la pestaña Yo.`, 'info');
}
// Gastar un punto. Devuelve null si salió bien o el motivo.
export function invertir(g, id) {
  const s = g.jugador.habilidades[id];
  if (!s) return 'Habilidad desconocida.';
  if (g.jugador.puntos <= 0) return 'No tenés puntos para gastar.';
  if (nivel(g, id) >= H(g).maximo) return 'Esa habilidad ya está al máximo.';
  const antes = nivel(g, id);
  s.invertidos++; g.jugador.puntos--;
  g.note(`Mejoraste tu ${rama(g, id).nombre} al nivel ${antes + 1}.${rama(g, id).ventajas[antes + 1] ? ' ' + rama(g, id).ventajas[antes + 1] : ''}`, 'ok');
  return null;
}

// ---------- Familia ----------
const FAM = g => g.jugador.familia;
export function familiaNombre(g) {
  const { pareja, hijos } = FAM(g), f = V(g).familia.find(x => x.pareja === pareja && x.hijos === hijos);
  return f?.nombre ?? `${pareja ? 'En pareja' : 'Soltero/a'}${hijos ? ` con ${hijos} hijo${hijos > 1 ? 's' : ''}` : ''}`;
}
export const gastoFamiliar = g => { const E = V(g).efectosFamilia; return (FAM(g).pareja ? E.gastoPareja : 0) + FAM(g).hijos * E.gastoHijo; };
export const vulnerabilidad = g => { const E = V(g).efectosFamilia; return 1 + (FAM(g).pareja ? E.vulnerabilidadPareja : 0) + FAM(g).hijos * E.vulnerabilidadHijo; };
const desgasteMult = g => { const E = V(g).efectosFamilia; return Math.max(0.5, 1 + (FAM(g).pareja ? E.desgastePareja : 0) + FAM(g).hijos * E.desgasteHijo); };

// ---------- Trabajo ----------
const factorTrabajo = g => { const t = g.jugador.trabajo; return (t.estado === 'completo' ? 1 : t.estado === 'reducido' ? V(g).trabajo.reducidoIngreso : 0) * (1 + t.mejora); };
export const aporteTrabajo = g => Math.round((g.trasfondo?.ingresoMensual ?? 0) * factorTrabajo(g));
export const trabajoNombre = e => ({ completo: 'Jornada completa', reducido: 'Media jornada', sin: 'Sin trabajo' }[e] ?? e);

// Multiplicador de duración de tus acciones: tu trasfondo, cuánto trabajás, la familia y las ventajas de Oratoria
export function tiempoMult(g, m) {
  const base = g.trasfondo?.duracionMult ?? 1, e = g.jugador.trabajo.estado, E = V(g).efectosFamilia;
  const trab = e === 'completo' ? base : e === 'reducido' ? 1 + (base - 1) / 2 : Math.min(base, V(g).trabajo.sinDuracion);
  let mult = trab * (1 + (FAM(g).pareja ? E.tiempoPareja : 0) + FAM(g).hijos * E.tiempoHijo + (g.carga?.tiempo ?? 0));
  if (m?.id === 'reunion' && nivel(g, 'oratoria') >= 3) mult *= 0.85;
  return mult;
}

// Decisión del jugador sobre su trabajo. Devuelve null si salió bien o el motivo.
export function cambiarTrabajo(g, nuevo) {
  const t = g.jugador.trabajo, T = V(g).trabajo;
  if (t.estado === nuevo) return 'Ya estás así.';
  if (t.estado === 'sin') return 'Sin trabajo no podés volver por tu cuenta: tiene que aparecer una oportunidad.';
  if (g.day - t.ultimoCambio < T.enfriamiento) return `Cambiaste hace poco: esperá ${T.enfriamiento - (g.day - t.ultimoCambio)} días.`;
  t.estado = nuevo; t.ultimoCambio = g.day;
  g.note(nuevo === 'sin' ? 'Dejaste tu trabajo para dedicarte de lleno al partido.' : nuevo === 'reducido' ? 'Pasaste a media jornada.' : 'Volviste a la jornada completa.', 'info');
  return null;
}

// ---------- Desgaste y descanso ----------
export const estaDescansando = g => !!g.jugador.descanso;
function empezarDescanso(g, dias) {
  const hasta = g.day + dias;
  g.jugador.descanso = g.jugador.descanso ? { desde: g.jugador.descanso.desde, hasta: Math.max(g.jugador.descanso.hasta, hasta) } : { desde: g.day, hasta };
}
export function descansar(g) {
  if (g.pending) return 'Resolvé el evento pendiente.';
  if (g.jugador.descanso) return 'Ya estás descansando.';
  if (g.freeSlots <= 0) return 'Estás ocupado: terminá lo que estás haciendo primero.';
  empezarDescanso(g, V(g).desgaste.descansoDias);
  g.note('Te tomaste unos días para descansar.', 'info');
  return null;
}
export const estadoDesgaste = g => { const D = V(g).desgaste, d = g.jugador.desgaste; return d >= D.critico ? 'agotado' : d >= D.alto ? 'cansado' : d >= 30 ? 'atento' : 'descansado'; };

// ---------- Eventos de vida ----------
function cumple(g, c = {}) {
  if (c.nunca) return false;
  const { pareja, hijos } = FAM(g);
  if (c.hijos !== undefined && hijos < c.hijos) return false;
  if (c.pareja !== undefined && pareja !== c.pareja) return false;
  if (c.hijosMenosDe !== undefined && hijos >= c.hijosMenosDe) return false;
  if (c.familia && !pareja && !hijos) return false;
  if (c.trabajo && g.jugador.trabajo.estado !== c.trabajo) return false;
  return true;
}
function eventoDeVida(g, rnd) {
  const lista = (g.cfg.eventos?.eventos ?? []).filter(e => e.tipo === 'vida' && cumple(g, e.cond));
  const ev = lista[Math.floor(rnd() * lista.length)];
  if (!ev) return;
  g.pending = ev; g.ultimoEvento = g.day;
  g.note(`Evento: ${ev.titulo}.`, 'info'); g.emit('event');
}
function despido(g, rnd) {
  const t = g.jugador.trabajo, T = V(g).trabajo, D = V(g).desgaste;
  if (t.estado === 'sin') return;
  const p = T.despidoMensual * (g.exposure >= 60 ? 1.5 : 0) + T.despidoMensual * (g.jugador.desgaste >= D.critico ? 1.5 : 0);
  if (p > 0 && rnd() < p) {
    t.estado = 'sin'; t.ultimoCambio = g.day;
    g.note(g.exposure >= 60 ? 'Te despidieron: los escándalos del partido llegaron a tu trabajo.' : 'Te despidieron: tu rendimiento por el cansancio fue el límite.', 'bad');
  }
}

// Efectos propios de los eventos de vida (los invoca events.aplicar)
export function aplicar(g, ef = {}) {
  const J = g.jugador;
  if (ef.desgaste) J.desgaste = clamp(J.desgaste + ef.desgaste, 0, 100);
  if (ef.descanso) empezarDescanso(g, ef.descanso);
  if (ef.familia) {
    if (ef.familia.hijos) J.familia.hijos = clamp(J.familia.hijos + ef.familia.hijos, 0, V(g).efectosFamilia.maxHijos);
    if (ef.familia.pareja === false) J.familia.pareja = false;
  }
  if (ef.trabajo && ['completo', 'reducido', 'sin'].includes(ef.trabajo)) { J.trabajo.estado = ef.trabajo; J.trabajo.ultimoCambio = g.day; }
  if (ef.trabajoMejora) J.trabajo.mejora = Math.min(0.6, J.trabajo.mejora + ef.trabajoMejora);
}

// ---------- Turno diario ----------
export function tick(g, rnd = Math.random) {
  const J = g.jugador, D = V(g).desgaste;
  const ocupado = g._ocupadoHoy ?? g.jobs.some(j => (j.modo ?? 'personal') === 'personal');
  if (J.descanso) {
    J.desgaste = clamp(J.desgaste + D.descansoDia, 0, 100);
    if (g.day >= J.descanso.hasta) { J.descanso = null; g.note('Terminaste de descansar.', 'ok'); g.informar?.({ tipo: 'descanso', nombre: 'Descanso', zona: null, zonaNombre: '', ok: true, texto: 'Terminaste de descansar: volvés con más energía.', cambios: []}); }
  } else J.desgaste = clamp(J.desgaste + (ocupado ? D.diaOcupado * desgasteMult(g) : D.diaLibre) + (g.carga?.desgaste ?? 0), 0, 100);
  if (J.desgaste >= D.crisis && g.day - J.ultimaCrisis >= D.enfriamientoCrisis && !g.pending) {
    const ev = g.cfg.eventos?.eventos.find(e => e.id === 'crisis_agotamiento');
    if (ev) { J.ultimaCrisis = g.day; g.pending = ev; g.ultimoEvento = g.day; g.note(`Evento: ${ev.titulo}.`, 'bad'); g.emit('event'); return; }
  }
  if (!g.org && J.fama > (J.famaBase ?? 0)) J.fama = Math.max(J.famaBase ?? 0, J.fama - (g.cfg.organizacion?.fama?.decae ?? 0.12));   // la fama propia se enfría
  if (g.day > 0 && g.day % 30 === 0) despido(g, rnd);
  if (g.day > 0 && g.day % 30 === 15 && !g.pending && rnd() < V(g).eventoMensual) eventoDeVida(g, rnd);
}

// ---------- Restauración segura desde un guardado ----------
export function sanear(g, raw, partido) {
  const base = iniciar(g, partido);
  if (!raw || typeof raw !== 'object') return base;
  if (typeof raw.nombre === 'string' && limpia(raw.nombre)) base.nombre = limpia(raw.nombre);
  if (raw.familia && typeof raw.familia === 'object') base.familia = { pareja: !!raw.familia.pareja, hijos: clamp(Math.floor(Number(raw.familia.hijos) || 0), 0, V(g).efectosFamilia.maxHijos) };
  const t = raw.trabajo;
  if (t && typeof t === 'object') base.trabajo = { estado: ['completo', 'reducido', 'sin'].includes(t.estado) ? t.estado : 'completo', mejora: fin(t.mejora) ? clamp(t.mejora, 0, 0.6) : 0, ultimoCambio: fin(t.ultimoCambio) ? t.ultimoCambio : -999 };
  if (raw.habilidades && typeof raw.habilidades === 'object') {
    for (const id of Object.keys(base.habilidades)) {
      const h = raw.habilidades[id];
      if (h && fin(h.xp) && fin(h.invertidos)) base.habilidades[id] = { xp: clamp(h.xp, 0, 1e6), invertidos: clamp(Math.floor(h.invertidos), 0, H(g).maximo), base: fin(h.base) ? clamp(Math.floor(h.base), 0, H(g).baseMax ?? 3) : base.habilidades[id].base };
    }
  }
  if (V(g).estilos?.some(e => e.id === raw.estilo)) base.estilo = raw.estilo;
  if (fin(raw.famaBase)) base.famaBase = clamp(raw.famaBase, 0, 100);
  if (fin(raw.fama)) base.fama = clamp(raw.fama, 0, 100);
  if (Array.isArray(raw.invitaciones)) base.invitaciones = raw.invitaciones.filter(i => i && typeof i.tipo === 'string' && fin(i.vence)).slice(0, 4).map(i => ({ tipo: i.tipo, vence: i.vence }));
  if (fin(raw.ultimaInvitacion)) base.ultimaInvitacion = raw.ultimaInvitacion;
  if (fin(raw.ultimaEmboscada)) base.ultimaEmboscada = raw.ultimaEmboscada;
  if (fin(raw.puntos)) base.puntos = clamp(Math.floor(raw.puntos), 0, 99);
  if (fin(raw.desgaste)) base.desgaste = clamp(raw.desgaste, 0, 100);
  if (fin(raw.ultimaCrisis)) base.ultimaCrisis = raw.ultimaCrisis;
  const d = raw.descanso;
  if (d && fin(d.desde) && fin(d.hasta)) base.descanso = { desde: d.desde, hasta: d.hasta };
  return base;
}
